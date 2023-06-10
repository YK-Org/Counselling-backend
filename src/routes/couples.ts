import express, { Request, Response } from "express";

const router = express.Router();

const addCouples = async (request: Request, response: Response) => {
  try {
    console.log("request.body", request.body);
    return response.status(201).json();
  } catch (err: any) {
    return response.status(201).json({ message: err.message });
  }
};

router.post("/couples", [], addCouples);

export default router;
