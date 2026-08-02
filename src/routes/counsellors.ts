import express, { Request, Response } from "express";
import UserService from "../services/users";
import { omit, pick } from "lodash";
import MiddlewareService from "../middleware/index";
import {
  handleError,
  handleNotFoundError,
  handleValidationError,
} from "../helpers/errorHandler";
import { userStatus } from "../types/models/Users";

const router = express.Router();

const getCounsellors = async (request: Request, response: Response) => {
  try {
    const data = await UserService.getCounsellors();
    const result = data.map((result: any) =>
      omit(result, ["password","resetTokenId", "__v", "createdAt", "updatedAt"])
    );
    return response.status(200).json(result);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get(
  "/counsellors",
  [MiddlewareService.allowedRoles(["headCounsellor"])],
  getCounsellors
);

const getCounsellor = async (request: Request, response: Response) => {
  try {
    const counsellorId = request.params.counsellorId;
    const data = await UserService.getCounsellor({ id: counsellorId });
    // This response was previously sent raw — it included the bcrypt hash.
    return response
      .status(200)
      .json(omit(data, ["password", "resetTokenId", "tokenIssuedAt"]));
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get(
  "/counsellors/:counsellorId",
  [MiddlewareService.allowedRoles(["headCounsellor"])],
  getCounsellor
);

const searchCounsellors = async (request: Request, response: Response) => {
  try {
    const { search } = request.query as any;
    const data = await UserService.searchCounsellors(search);
    const result = data.map((result: any) =>
      omit(result, ["password","resetTokenId", "__v", "createdAt", "updatedAt"])
    );
    return response.status(200).json(result);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get(
  "/search/counsellors",
  [MiddlewareService.allowedRoles(["headCounsellor"])],
  searchCounsellors
);

// Only these may be set through this endpoint. Passing request.body straight
// through let a caller write `role`, overwrite `password` with an unhashed
// string, or clobber `tokenIssuedAt` to forge session validity.
const UPDATABLE_COUNSELLOR_FIELDS = [
  "firstName",
  "lastName",
  "phoneNumber",
  "status",
  "availability",
];

const updateCounsellor = async (request: Request, response: Response) => {
  try {
    const counsellorId = request.params.counsellorId;
    const body = pick(request.body, UPDATABLE_COUNSELLOR_FIELDS);

    if (!Object.keys(body).length) {
      return handleValidationError(response, "No updatable fields provided");
    }
    if (body.status !== undefined && !userStatus.includes(body.status)) {
      return handleValidationError(
        response,
        `status must be one of: ${userStatus.join(", ")}`
      );
    }
    if (body.availability !== undefined && typeof body.availability !== "boolean") {
      return handleValidationError(response, "availability must be a boolean");
    }

    // The route is scoped to counsellors — without this check a head
    // counsellor could edit (or ban) another head counsellor through it.
    const target = await UserService.getUser(counsellorId);
    if (!target || target.role !== "counsellor") {
      return handleNotFoundError(response, "Counsellor not found");
    }

    const data = await UserService.updateUser(body, counsellorId);
    return response.status(200).json(omit(data, ["password","resetTokenId", "tokenIssuedAt"]));
  } catch (err: any) {
    return handleError(
      response,
      err,
      "updateCounsellor",
      "Failed to update counsellor"
    );
  }
};

router.put(
  "/counsellors/:counsellorId",
  [MiddlewareService.allowedRoles(["headCounsellor"])],
  updateCounsellor
);
export default router;
