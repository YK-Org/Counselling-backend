import express, { Request, Response } from "express";
import multer from "multer";
import MediaService from "../services/media";
const upload = multer({ dest: "beadutiful/" });

const router = express.Router();

const uploadFiles = async (request: Request, response: Response) => {
  try {
    const files = request.files ? request.files : [];
    const uploadedFiles = await MediaService.uploadFiles(files);
    response.status(200).send({ data: uploadedFiles });
  } catch (error) {
    response.status(400).send(error);
  }
};

router.post("/media", upload.array("files"), uploadFiles);

export default router;
