import express, { Request, Response } from "express";
import LessonsService from "../services/lessons";
import MiddlewareService from "../middleware/index";
import {
  handleConflictError,
  handleError,
  handleNotFoundError,
  handleValidationError,
} from "../helpers/errorHandler";

const router = express.Router();

const addLessons = async (request: Request, response: Response) => {
  try {
    const { name } = request.body;
    if (!name || !String(name).trim()) {
      return handleValidationError(response, "name is required");
    }

    // No file upload here: a Lesson is a name and nothing else. This route used
    // to run `upload.array("files")`, so multer wrote every attached file into
    // uploads/lessons/ and nothing ever read, stored or deleted them — they
    // accumulated on the server's disk forever.
    const data = await LessonsService.createLessons({ name: String(name).trim() });
    return response.status(201).json(data);
  } catch (err: any) {
    return handleError(response, err, "addLessons", "Failed to create lesson");
  }
};

router.post(
  "/lessons",
  [MiddlewareService.allowedRoles(["headCounsellor"])],
  addLessons
);

const getLessons = async (_request: Request, response: Response) => {
  try {
    const data = await LessonsService.getLessons();
    return response.status(200).json(data);
  } catch (err: any) {
    return handleError(response, err, "getLessons", "Failed to fetch lessons");
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

    const lesson = await LessonsService.getLesson({ id: lessonsId });
    if (!lesson) {
      return handleNotFoundError(response, "Lesson not found");
    }

    // Both relations to Lesson are required with no cascade, so deleting one
    // that couples have completed — or that has assignments hanging off it —
    // is refused by the database and surfaced as a raw 500. Deleting it is not
    // what anyone wants anyway: it would erase the record that a couple
    // finished that lesson. Say so instead.
    const usage = await LessonsService.countLessonUsage(lessonsId);
    if (usage.completions || usage.assignments) {
      const reasons = [
        usage.completions && `completed by ${usage.completions} couple(s)`,
        usage.assignments && `used by ${usage.assignments} assignment(s)`,
      ].filter(Boolean);
      return handleConflictError(
        response,
        `This lesson cannot be deleted because it is ${reasons.join(" and ")}.`
      );
    }

    await LessonsService.deleteLesson(lessonsId);
    return response.status(200).json({});
  } catch (err: any) {
    return handleError(response, err, "deleteLessons", "Failed to delete lesson");
  }
};

router.delete(
  "/lessons/:lessonsId",
  [MiddlewareService.allowedRoles(["headCounsellor"])],
  deleteLessons
);

export default router;
