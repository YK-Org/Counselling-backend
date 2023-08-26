import express, { Request, Response } from "express";
import UserService from "../services/users";
import { omit } from "lodash";
import { generatePassword } from "../helpers/generatePassword";
import MiddlewareService from "../middleware/index";

const router = express.Router();

const getCounsellors = async (request: Request, response: Response) => {
  try {
    const data = await UserService.getCounsellors();
    const result = data.map((result: any) =>
      omit(result.toObject(), ["password", "__v", "createdAt", "updatedAt"])
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
    const data = await UserService.getCounsellor({ _id: counsellorId });
    return response.status(200).json(data);
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
      omit(result.toObject(), ["password", "__v", "createdAt", "updatedAt"])
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

export default router;
