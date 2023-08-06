import express, { Request, Response } from "express";
import FormsService from "../services/forms";
import MiddlewareService from "../middleware/index";

const router = express.Router();

const addForms = async (request: Request, response: Response) => {
  try {
    const body = request.body;
    const data = await FormsService.createForms(body);

    return response.status(201).json(data);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.post(
  "/forms",
  [MiddlewareService.allowedRoles(["headCounsellor"])],
  addForms
);

const getForms = async (request: Request, response: Response) => {
  try {
    const query = request.query;
    const data = await FormsService.getForms(query);
    return response.status(200).json(data);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get(
  "/forms",
  [MiddlewareService.allowedRoles(["headCounsellor", "counsellor"])],
  getForms
);

export default router;
