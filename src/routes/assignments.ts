import express, { Request, Response } from "express";
import AssignmentsService from "../services/assignments";
import StorageService from "../services/storage";
import MiddlewareService from "../middleware/index";
import { canAccessCouple } from "../helpers/coupleAccess";
import {
  handleError,
  handleForbiddenError,
  handleValidationError,
} from "../helpers/errorHandler";
import { AuthenticatedRequest } from "../types";
import multer from "multer";
const upload = multer({ dest: "uploads/assignments/" });

const router = express.Router();

const addAssignments = async (request: Request, response: Response) => {
  try {
    const body = request.body;
    const user = (request as AuthenticatedRequest).user;

    if (!body.couplesId || !body.lessonId) {
      return handleValidationError(
        response,
        "couplesId and lessonId are required"
      );
    }

    // Checked before anything is uploaded: nothing should reach storage on
    // behalf of a couple the caller has no business writing to. Previously any
    // counsellor could attach files to any couple's record.
    if (!(await canAccessCouple(user, body.couplesId))) {
      return handleForbiddenError(response);
    }

    let uploadedFiles: { id: string; name: string }[] = [];
    if (request.files) {
      uploadedFiles = await StorageService.uploadFiles(
        request.files as any[],
        "assignments"
      );
    }
    body.uploads = uploadedFiles;
    const result = await AssignmentsService.createAssignment(body);
    const data = await AssignmentsService.getAssignment({ id: result.id });
    return response.status(201).json(data);
  } catch (err: any) {
    return handleError(
      response,
      err,
      "addAssignments",
      "Failed to create assignment"
    );
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
    const user = (request as AuthenticatedRequest).user;

    const assignment = await AssignmentsService.getAssignment({
      id: assignmentsId,
    });

    // Same answer for "not yours" and "does not exist" — deleting another
    // counsellor's assignment also destroyed the stored files behind it.
    if (!assignment || !(await canAccessCouple(user, assignment.couplesId))) {
      return handleForbiddenError(response);
    }

    const uploads = (assignment.uploads as { id: string; name: string }[]) || [];
    if (uploads.length) {
      await StorageService.deleteFiles(uploads.map((upload) => upload.id));
    }
    await AssignmentsService.deleteAssignment(assignmentsId);
    return response.status(200).json({});
  } catch (err: any) {
    return handleError(
      response,
      err,
      "deleteAssignments",
      "Failed to delete assignment"
    );
  }
};

router.delete(
  "/assignments/:assignmentsId",
  [MiddlewareService.allowedRoles(["headCounsellor", "counsellor"])],
  deleteAssignments
);

const getAssignments = async (request: Request, response: Response) => {
  try {
    const user = (request as AuthenticatedRequest).user;
    const { couplesId } = request.query as { couplesId?: string };

    // The query string used to become Prisma's `where` verbatim and the portal
    // asked for no filter at all, so opening one couple's page pulled every
    // assignment in the system down to the browser. A couple must be named,
    // and it must be one the caller can see.
    if (!couplesId) {
      return handleValidationError(response, "couplesId is required");
    }
    if (!(await canAccessCouple(user, couplesId))) {
      return handleForbiddenError(response);
    }

    const data = await AssignmentsService.getAssignments({ couplesId });
    return response.status(200).json(data);
  } catch (err: any) {
    return handleError(
      response,
      err,
      "getAssignments",
      "Failed to fetch assignments"
    );
  }
};

router.get(
  "/assignments",
  [MiddlewareService.allowedRoles(["headCounsellor", "counsellor"])],
  getAssignments
);

export default router;
