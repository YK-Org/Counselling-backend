import express, { Request, Response } from "express";
import UserService from "../services/users";
import { omit } from "lodash";

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
export default router;
