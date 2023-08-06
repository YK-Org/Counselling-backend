import express, { Request, Response } from "express";
import LessonsService from "../services/lessons";
import MiddlewareService from "../middleware/index";

const router = express.Router();

const addLessons = async (request: Request, response: Response) => {
  try {
    const body = request.body;
    const data = await LessonsService.createLessons(body);

    return response.status(201).json(data);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.post(
  "/lessons",
  [MiddlewareService.allowedRoles(["headCounsellor"])],
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

export default router;
