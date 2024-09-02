import express, { Request, Response } from "express";
import CouplesService from "../services/couples";
import UserService from "../services/users";
import MiddlewareService from "../middleware/index";
import bcrypt from "bcrypt";
import AuthService from "../services/auth";
import { omit } from "lodash";

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

const changePassword = async (request: Request, response: Response) => {
  try {
    const oldPassword = request.body.oldPassword;
    const id = (request as any).user._id;
    const getUser = await UserService.getUser(id);
    const checkPassword = await bcrypt.compare(
      oldPassword,
      getUser?.password || ""
    );
    if (!checkPassword) {
      throw new Error("Password could not be changed");
    }
    const password = request.body.password;
    const encryptedUserPassword = await bcrypt.hash(password, 10);

    if (getUser) {
      const userData: any = {
        ...omit(getUser.toObject(), [
          "password",
          "__v",
          "createdAt",
          "updatedAt",
        ]),
      };
      const token = AuthService.generateAccessToken(userData);
      const data = {
        user: userData,
        token: token.token,
      };

      await UserService.updateUser(
        { password: encryptedUserPassword, tokenIssuedAt: token.issuedAt },
        id
      );

      return response.status(200).send(data);
    } else {
      throw new Error("Error changing password");
    }
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.post(
  "/change/password",
  [MiddlewareService.allowedRoles(["headCounsellor", "counsellor"])],
  changePassword
);

export default router;
