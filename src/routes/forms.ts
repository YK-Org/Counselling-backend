import express, { Request, Response } from "express";
import FormsService from "../services/forms";

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

router.post("/forms", [], addForms);

const getForms = async (request: Request, response: Response) => {
  try {
    const query = request.query;
    const data = await FormsService.getForms(query);
    return response.status(200).json(data);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get("/forms", [], getForms);

export default router;
