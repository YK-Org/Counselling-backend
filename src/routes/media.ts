import express, { Request, Response } from "express";
import MediaService from "../services/media";
import archiver from "archiver";
const path = require("path");
const router = express.Router();
const fs = require("fs");

const viewMedia = async (request: Request, response: Response) => {
  try {
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });
    const ids = await MediaService.viewFileInDrive(request.body.mediaIds);
    const files = ids.map((id) => path.resolve(__dirname, `../../${id}.png`));
    if (files.length > 1) {
      archive.on("error", (err: any) => {
        response.status(500).send({ error: err.message });
      });

      response.attachment("files.zip");
      archive.pipe(response);

      files.forEach((file) => {
        const fileName = path.basename(file);
        archive.file(file, { name: fileName });
      });

      archive.finalize();

      archive.on("end", () => {
        files.forEach((file) => {
          fs.unlink(file, (err: any) => err && console.error(err));
        });
        response.status(200);
      });
    } else {
      return response.download(files[0], "filename.txt", (err: any) => {
        if (err) {
          response.status(500).send("Something went wrong");
        } else {
          fs.unlink(files[0], (err: any) => err && console.error(err));
          response.status(200);
        }
      });
    }
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.put("/media", [], viewMedia);

export default router;
