import express, { Request, Response } from "express";
import MediaService from "../services/media";
const path = require("path");
const router = express.Router();
const fs = require("fs");

const viewMedia = async (request: Request, response: Response) => {
  try {
    await MediaService.viewFileInDrive(request.params.mediaId);
    const file = path.resolve(__dirname, `../../downloadedFile.png`);
    return response.download(file, "filename.txt", (err: any) => {
      if (err) {
        response.status(500).send("Something went wrong");
      } else {
        fs.unlink(file, (err: any) => err && console.error(err));
        response.status(200);
      }
    });
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get("/media/:mediaId", [], viewMedia);

export default router;
