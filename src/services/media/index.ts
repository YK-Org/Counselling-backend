import { v2 as cloudinary } from "cloudinary";
import * as fs from "fs/promises";
import { createWriteStream } from "fs";
import { get } from "lodash";
import { ulid } from "ulid";
import { extension } from "mime-types";
const path = require("path");
const createReadStream = require("fs").createReadStream;
const { google } = require("googleapis");
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
];

class MediaService {
  async authorize() {
    const pkey = {
      type: "service_account",
      project_id: process.env.PROJECT_ID,
      private_key: process.env.PRIVATE_KEY,
      client_email: process.env.CLIENT_EMAIL,
      client_id: process.env.CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.CLIENT_CERT_URL,
      universe_domain: "googleapis.com",
    };
    const jwtClient = new google.auth.JWT(
      pkey.client_email,
      null,
      pkey.private_key,
      SCOPES
    );
    await jwtClient.authorize();
    return jwtClient;
  }

  async uploadFilesToDrive(files: any, uploadType: string) {
    try {
      const mapFolders = {
        assignments: process.env.ASSIGNMENTS_FOLDER_ID,
        lessons: process.env.LESSONS_FOLDER_ID,
        letters: process.env.LETTERS_FOLDER_ID,
        "profile-pictures": process.env.PROFILE_PICTURES_FOLDER_ID,
      };
      // Without this the folder id goes to Drive as `parents: [undefined]`,
      // which fails with an opaque API error at upload time rather than
      // naming the variable that is actually missing.
      const folderId = get(mapFolders, uploadType);
      if (!folderId) {
        throw new Error(
          `No Drive folder configured for "${uploadType}" — check the corresponding *_FOLDER_ID environment variable`
        );
      }

      const result = await this.authorize();
      const drive = await google.drive({ version: "v3", auth: result });
      const uploadedFiles: { id: string; name: string }[] = [];
      for (const file of files) {
        const uploadedFile = await drive.files.create({
          media: {
            body: createReadStream(
              path.resolve(
                __dirname,
                `../../../uploads/${uploadType}/${file.filename}`
              )
            ),
          },
          fields: "id, name",
          requestBody: {
            name: `${file.filename}/${file.originalname}`,
            parents: [folderId],
          },
        });

        uploadedFiles.push({
          id: uploadedFile.data.id,
          name: uploadedFile.data.name,
        });
        await fs.unlink(file.path);
      }
      return uploadedFiles;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  async deleteFilesInDrive(files: any) {
    try {
      const result = await this.authorize();
      const drive = await google.drive({ version: "v3", auth: result });
      for (const file of files) {
        await drive.files.delete({
          fileId: file.id,
        });
      }
      return;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  async getFromGoogleDrive(fileId: string): Promise<string> {
    const result = await this.authorize();
    const drive = await google.drive({ version: "v3", auth: result });
    const id = ulid();
    return new Promise((resolve, reject) => {
      drive.files.get(
        {
          fileId: fileId,
          fields: "mimeType",
        },
        (err: any, fileRes: any) => {
          if (err) {
            console.error("Error retrieving file metadata:", err);
            reject(err);
            return;
          }

          const mimeType = fileRes.data.mimeType;
          const ext = extension(mimeType) || "bin";
          const destFileName = `${id}.${ext}`;
          const dest = createWriteStream(destFileName);

          drive.files.get(
            { fileId: fileId, alt: "media" },
            { responseType: "stream" },
            (err: any, res: any) => {
              if (err) {
                reject(err);
                return;
              }
              res.data
                .on("end", () => {
                  console.log("Download complete");
                  resolve(destFileName);
                })
                .on("error", (err: any) => {
                  console.error("Download error:", err);
                  reject(err);
                })
                .pipe(dest);
            }
          );
        }
      );
    });
  }

  // Drive file ids are immutable — replacing a picture creates a new id — so a
  // cached copy can never go stale and the id doubles as a strong ETag.
  // Without this every avatar render is a full Drive round-trip through the
  // server, which does not survive contact with a list of counsellors.
  private profilePictureCacheDir = path.resolve(
    __dirname,
    "../../../uploads/cache/profile-pictures"
  );

  async getCachedProfilePicture(fileId: string): Promise<string> {
    await fs.mkdir(this.profilePictureCacheDir, { recursive: true });

    const entries = await fs.readdir(this.profilePictureCacheDir);
    const cached = entries.find((entry) => entry.startsWith(`${fileId}.`));
    if (cached) return path.join(this.profilePictureCacheDir, cached);

    // getFromGoogleDrive writes to a ulid-named file in the working directory;
    // move it into the cache under the id so the next request is a local read.
    const downloaded = await this.getFromGoogleDrive(fileId);
    const destination = path.join(
      this.profilePictureCacheDir,
      `${fileId}${path.extname(downloaded)}`
    );
    await fs.rename(downloaded, destination);
    return destination;
  }

  async evictCachedProfilePicture(fileId: string) {
    try {
      const entries = await fs.readdir(this.profilePictureCacheDir);
      await Promise.all(
        entries
          .filter((entry) => entry.startsWith(`${fileId}.`))
          .map((entry) =>
            fs.unlink(path.join(this.profilePictureCacheDir, entry))
          )
      );
    } catch (error: any) {
      // A missing cache directory or entry is not worth failing an upload over.
      if (error?.code !== "ENOENT") throw error;
    }
  }

  async viewFileInDrive(fileId: string | string[]): Promise<string[]> {
    try {
      let fileNames: string[] = [];
      if (Array.isArray(fileId)) {
        for (const item of fileId) {
          const response = await this.getFromGoogleDrive(item);
          fileNames.push(response);
        }
      } else {
        const response = await this.getFromGoogleDrive(fileId);
        fileNames = [response];
      }
      return fileNames;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  async uploadFiles(files: any, folder = "counselling") {
    try {
      const uploadedFiles: string[] = [];
      for (const file of files) {
        const publicId = file.path.split("\\")[2];
        const response = await cloudinary.uploader.upload(file.path, {
          folder,
          type: "authenticated",
          access_mode: "authenticated",
          public_id: publicId,
        });
        uploadedFiles.push(response.secure_url);
        await fs.unlink(file.path);
      }
      return uploadedFiles;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  async deleteUploadedFiles(files: any) {
    try {
      for (const path of files) {
        console.log(
          "pathpath",
          path.split("/")[path.split("/").length - 1].split(".")[0]
        );
        const pubicId = path
          .split("/")
          [path.split("/").length - 1].split(".")[0];
        console.log("pubicId", pubicId);
        // await cloudinary.uploader.destroy(pubicId);
        await cloudinary.uploader.destroy(
          "f6bca446122743ce82005972dcfe4b29",
          { invalidate: true, resource_type: "image" },
          function (result: any) {
            console.log(result);
          }
        );
      }
      return true;
    } catch (error: any) {
      console.log("Herree", error);
      throw new Error(error.message);
    }
  }
}
export default new MediaService();
