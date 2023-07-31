import express, { Request, Response } from "express";
import UserService from "../services/users";
import { omit } from "lodash";
import { generatePassword } from "../helpers/generatePassword";

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

router.get("/counsellors", [], getCounsellors);

const getCounsellor = async (request: Request, response: Response) => {
  try {
    const counsellorId = request.params.counsellorId;
    const data = await UserService.getCounsellor({ _id: counsellorId });
    return response.status(200).json(data);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get("/counsellors/:counsellorId", [], getCounsellor);

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

router.get("/search/counsellors", [], searchCounsellors);

const createCounsellor = async (request: Request, response: Response) => {
  try {
    const body = request.body;
    body.password = generatePassword();
    const data = await UserService.createCounsellor(body);
    const result = omit(data, ["password", "__v", "createdAt", "updatedAt"]);
    return response.status(200).json(result);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.post("/counsellors", [], createCounsellor);
export default router;
