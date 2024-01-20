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
      console.log("ygyg", request.files.length);
      // await MediaService.authorize();
      uploadedFiles = await MediaService.uploadFilesToDrive(request.files);
    }
    body.uploads = uploadedFiles;
    const result = await AssignmentsService.createAssignment(body);
    const data = await AssignmentsService.getAssignment({ _id: result.id });
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

const deleteAssignments = async (request: Request, response: Response) => {
  try {
    const { assignmentsId } = request.params;
    const assignment = await AssignmentsService.getAssignment({
      _id: assignmentsId,
    });
    if (assignment && assignment.uploads.length) {
      await MediaService.deleteFilesInDrive(assignment.uploads);
    }
    await AssignmentsService.deleteAssignment(assignmentsId);
    return response.status(201).json({});
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.delete(
  "/assignments/:assignmentsId",
  [MiddlewareService.allowedRoles(["headCounsellor", "counsellor"])],
  deleteAssignments
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
