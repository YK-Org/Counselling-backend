import express, { Request, Response } from "express";
import CouplesService from "../services/couples";
import UserService from "../services/users";

const router = express.Router();

const dashboardInit = async (request: Request, response: Response) => {
  try {
    const unassignedCouplesCount =
      await CouplesService.countUnassignedCouples();
    const availableCounsellorsCount =
      await UserService.countAvailableCounsellors();
    const countCompletedSessions =
      await CouplesService.countCompletedSessions();
    return response.status(200).json({
      unassignedCouplesCount,
      availableCounsellorsCount,
      countCompletedSessions,
    });
  } catch (err) {
    console.log(err);
  }
};

router.get("/dashboard/init", [], dashboardInit);

export default router;
