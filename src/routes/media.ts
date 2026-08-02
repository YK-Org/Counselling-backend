import express, { Request, Response } from "express";
import StorageService from "../services/storage";
import archiver from "archiver";
import path from "path";

const router = express.Router();

// Streams objects straight from R2 to the client. Unlike avatars this cannot
// be a signed URL: a multi-file request is zipped on the fly, and that archive
// exists nowhere as an object. Single files stream too, so neither path stages
// anything on local disk — which the Drive implementation did for every
// download, then deleted afterwards in a success-only callback.
const viewMedia = async (request: Request, response: Response) => {
  try {
    const mediaIds: string[] = request.body.mediaIds || [];

    if (!mediaIds.length) {
      return response.status(400).json({ message: "No media requested" });
    }

    if (mediaIds.length === 1) {
      const key = mediaIds[0];
      const stream = await StorageService.getStream(key);

      response.attachment(path.basename(key));
      stream.on("error", (err: any) => {
        console.error("Error streaming media", err?.message);
        if (!response.headersSent) {
          response.status(500).json({ message: "Failed to download file" });
        } else {
          response.destroy();
        }
      });

      return stream.pipe(response);
    }

    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err: any) => {
      console.error("Error building archive", err?.message);
      if (!response.headersSent) {
        response.status(500).json({ message: "Failed to build archive" });
      } else {
        response.destroy();
      }
    });

    response.attachment("files.zip");
    archive.pipe(response);

    for (const key of mediaIds) {
      const stream = await StorageService.getStream(key);
      archive.append(stream, { name: path.basename(key) });
    }

    return archive.finalize();
  } catch (err: any) {
    if (response.headersSent) return response.destroy();
    return response.status(500).json({ message: err.message });
  }
};

router.put("/media", [], viewMedia);

export default router;
