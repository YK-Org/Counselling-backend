import express, { Request, Response } from "express";
import ResourcesService from "../services/resources";
import MiddlewareService from "../middleware/index";
import MediaService from "../services/media";
import multer from "multer";
const upload = multer({ dest: "uploads/resources/" });
const router = express.Router();

const addResources = async (request: Request, response: Response) => {
  try {
    const body = request.body;
    let uploadedFiles: { id: string; name: string }[] = [];
    if (request.files) {
      uploadedFiles = await MediaService.uploadFilesToDrive(
        request.files,
        "resources"
      );
    }
    body.uploads = uploadedFiles;
    const data = await ResourcesService.createResources(body);

    return response.status(201).json(data);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.post(
  "/resources",
  [MiddlewareService.allowedRoles(["headCounsellor"]), upload.array("files")],
  addResources
);

const getResources = async (request: Request, response: Response) => {
  try {
    const query = request.query;
    const data = await ResourcesService.getResources(query);
    return response.status(200).json(data);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get(
  "/resources",
  [MiddlewareService.allowedRoles(["headCounsellor", "counsellor"])],
  getResources
);

const deleteResources = async (request: Request, response: Response) => {
  try {
    const { resourcesId } = request.params;
    const lesson = await ResourcesService.getLesson({
      _id: resourcesId,
    });
    if (lesson && lesson.uploads && lesson.uploads.length) {
      await MediaService.deleteFilesInDrive(lesson.uploads);
    }
    await ResourcesService.deleteLesson(resourcesId);
    return response.status(201).json({});
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.delete(
  "/resources/:resourcesId",
  [MiddlewareService.allowedRoles(["headCounsellor"])],
  deleteResources
);

export default router;
