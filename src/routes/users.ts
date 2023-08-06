import express, { Request, Response } from "express";
import CouplesService from "../services/couples";
import UserService from "../services/users";
import MiddlewareService from "../middleware/index";

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

router.get(
  "/dashboard/init",
  [MiddlewareService.allowedRoles(["headCounsellor"])],
  dashboardInit
);

export default router;
