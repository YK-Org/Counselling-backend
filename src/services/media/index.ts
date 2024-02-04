import { v2 as cloudinary } from "cloudinary";
import * as fs from "fs/promises";
const path = require("path");
const createReadStream = require("fs").createReadStream;
const { google } = require("googleapis");
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

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

  async uploadFilesToDrive(files: any) {
    try {
      const result = await this.authorize();
      const drive = await google.drive({ version: "v3", auth: result });
      const uploadedFiles: string[] = [];
      for (const file of files) {
        const uploadedFile = await drive.files.create({
          media: {
            body: createReadStream(
              path.resolve(
                __dirname,
                `../../../uploads/assignments/${file.filename}`
              )
            ),
          },
          fields: "id",
          requestBody: {
            name: file.filename,
            parents: [process.env.FOLDER_ID],
          },
        });

        uploadedFiles.push(uploadedFile.data.id);
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
          fileId: file,
        });
      }
      return;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  async viewFileInDrive(fileId: string) {
    try {
      const result = await this.authorize();
      const drive = await google.drive({ version: "v3", auth: result });

      const expirationTime = 3600;
      const permissionParams = {
        fileId,
        resource: {
          role: "reader",
          type: "anyone",
        },
      };
      const permissions = await drive.permissions.create(permissionParams);

      return `https://drive.google.com/file/d/${fileId}/view?usp=sharing&permissions=${
        permissions.data.id
      }&expiry=${Math.floor(Date.now() / 1000) + expirationTime}`;
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
