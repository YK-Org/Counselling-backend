import express, { Request, Response } from "express";
import LessonsService from "../services/lessons";
import MiddlewareService from "../middleware/index";
import MediaService from "../services/media";
import multer from "multer";
const upload = multer({ dest: "uploads/lessons/" });
const router = express.Router();

const addLessons = async (request: Request, response: Response) => {
  try {
    const body = request.body;
    let uploadedFiles: { id: string; name: string }[] = [];
    if (request.files) {
      uploadedFiles = await MediaService.uploadFilesToDrive(
        request.files,
        "lessons"
      );
    }
    body.uploads = uploadedFiles;
    const data = await LessonsService.createLessons(body);

    return response.status(201).json(data);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.post(
  "/lessons",
  [MiddlewareService.allowedRoles(["headCounsellor"]), upload.array("files")],
  addLessons
);

const getLessons = async (request: Request, response: Response) => {
  try {
    const query = request.query;
    const data = await LessonsService.getLessons(query);
    return response.status(200).json(data);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get(
  "/lessons",
  [MiddlewareService.allowedRoles(["headCounsellor", "counsellor"])],
  getLessons
);

const deleteLessons = async (request: Request, response: Response) => {
  try {
    const { lessonsId } = request.params;
    const lesson = await LessonsService.getLesson({
      _id: lessonsId,
    });
    if (lesson && lesson.uploads && lesson.uploads.length) {
      await MediaService.deleteFilesInDrive(lesson.uploads);
    }
    await LessonsService.deleteLesson(lessonsId);
    return response.status(201).json({});
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.delete(
  "/lessons/:lessonsId",
  [MiddlewareService.allowedRoles(["headCounsellor"])],
  deleteLessons
);

export default router;
