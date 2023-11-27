import express, { Request, Response } from "express";
import AssignmentsService from "../services/assignments";
import MediaService from "../services/media";
import MiddlewareService from "../middleware/index";
import multer from "multer";
const upload = multer({ dest: "uploads/assignments/" });

const router = express.Router();

const addAssignments = async (request: Request, response: Response) => {
  try {
    const body = request.body;
    let uploadedFiles: string[] = [];
    if (request.files) {
      uploadedFiles = await MediaService.uploadFiles(request.files);
    }
    body.uploads = uploadedFiles;
    const data = await AssignmentsService.createAssignment(body);

    return response.status(201).json(data);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.post(
  "/assignments",
  [
    MiddlewareService.allowedRoles(["headCounsellor", "counsellor"]),
    upload.array("files"),
  ],
  addAssignments
);

const getAssignments = async (request: Request, response: Response) => {
  try {
    const query = request.query;
    const data = await AssignmentsService.getAssignments(query);
    return response.status(200).json(data);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get(
  "/assignments",
  [MiddlewareService.allowedRoles(["headCounsellor", "counsellor"])],
  getAssignments
);

export default router;
