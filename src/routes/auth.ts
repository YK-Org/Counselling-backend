import express, { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import AuthService from "../services/auth";
import UserService from "../services/users";
import { LoginValidation } from "../validationClasses/auth/login";
import MiddlewareService from "../middleware/index";
import { omit } from "lodash";
import * as jwt from "jsonwebtoken";
import { sendMail } from "../helpers/mailer";
import { passwordRequestMail } from "../helpers/mailTemplate";
import { authLimiter } from "../middleware/rateLimiter";

const router = express.Router();

const login = async (request: Request, response: Response) => {
  try {
    const { email, password } = request.body;

    const user = await UserService.getUsers({ email });
    if (user?.length && user[0].status === "awaitingConfirmation") {
      throw new Error("Account has not been confirmed");
    }

    if (user?.length && (await bcrypt.compare(password, user[0].password))) {
      const userData: any = {
        ...omit(user[0], [
          "password",
          "resetTokenId",
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
        {
          tokenIssuedAt: token.issuedAt,
        },
        user[0].id
      );
      return response.status(200).send(data);
    } else {
      throw new Error("Invalid Credentials");
    }
  } catch (error: any) {
    return response.status(400).send(error.message);
  }
};

router.post(
  "/login",
  [authLimiter, MiddlewareService.requestValidation(LoginValidation)],
  login
);

// Public self-registration was removed: every account in this app is staff, so
// accounts are created by a head counsellor via POST /api/v1/users, and the
// very first one by `npm run prisma:seed`.

const authCheck = async (request: Request, response: Response) => {
  try {
    const authHeader = request.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token == null) return response.sendStatus(401);
    const decoded: any = jwt.verify(token, process.env.TOKEN_SECRET as string);
    if (!decoded) {
      return response.sendStatus(401);
    }

    const data = {
      ...omit(decoded.user, [
        "password",
        "resetTokenId",
        "__v",
        "createdAt",
        "updatedAt",
        "iat",
        "exp",
      ]),
    };
    return response.status(201).json(data);
  } catch (err: any) {
    return response.status(401).json({ message: err.message });
  }
};

router.get("/auth/check", authCheck);

const forgotPasswordRequest = async (request: Request, response: Response) => {
  try {
    const email = request.body.email;
    const user = await UserService.getUsers({ email });
    if (user && user.length) {
      const userData: any = {
        ...omit(user[0], [
          "password",
          "resetTokenId",
          "__v",
          "createdAt",
          "updatedAt",
        ]),
      };
      // Minting a new link invalidates any previous outstanding one.
      const resetTokenId = crypto.randomUUID();
      await UserService.updateUser({ resetTokenId }, user[0].id);

      const token = AuthService.generateAccessToken(
        userData,
        "passwordReset",
        "900s",
        { resetTokenId }
      );
      const link = `${process.env.APP_URL}/password/reset?tok=${token.token}`;

      const mailOptions = {
        from: "Counsellor App <counsellortrinity@gmail.com>",
        to: email,
        subject: "Password Reset",
        text: "",
        html: passwordRequestMail(link),
      };
      await sendMail(mailOptions);
    } else {
      throw new Error("User cannot be found");
    }
    return response.status(200).send({});
  } catch (error: any) {
    console.log("error", error);
    return response.status(400).send(error);
  }
};

router.post("/forgot-password/request", [authLimiter], forgotPasswordRequest);

const forgotPasswordReset = async (request: Request, response: Response) => {
  try {
    const password = request.body.password;
    const id = (request as any).user.id;
    const encryptedUserPassword = await bcrypt.hash(password, 10);

    // Consuming an invite link is what activates the account — setting a
    // password is the confirmation. Only awaitingConfirmation is promoted, so
    // a banned user cannot reinstate themselves via password reset.
    const existing = await UserService.getUser(id);
    const activates = existing?.status === "awaitingConfirmation";

    const user = await UserService.updateUser(
      {
        password: encryptedUserPassword,
        // Spend the link — it must not work a second time.
        resetTokenId: null,
        ...(activates ? { status: "active" } : {}),
      },
      id
    );
    if (user) {
      const userData: any = {
        ...omit(user, ["password","resetTokenId", "__v", "createdAt", "updatedAt"]),
      };
      const token = AuthService.generateAccessToken(userData);
      const data = {
        user: userData,
        token: token.token,
      };

      await UserService.updateUser(
        {
          tokenIssuedAt: token.issuedAt,
        },
        user.id
      );

      return response.status(200).send(data);
    } else {
      throw new Error("Error resetting password");
    }
  } catch (error) {
    return response.status(400).send(error);
  }
};

router.post(
  "/forgot-password/reset",
  [MiddlewareService.checkPasswordReset],
  forgotPasswordReset
);

const confirmPassword = async (request: Request, response: Response) => {
  try {
    const password = request.body.password;
    const id = (request as any).user.id;
    const user = await UserService.getUser(id);
    const checkPassword = await bcrypt.compare(password, user?.password || "");
    if (!checkPassword) {
      throw new Error("Invalid credentials");
    }
    return response.status(200).send({});
  } catch (error: any) {
    return response.status(400).send(error.message);
  }
};

router.post(
  "/confirm-password",
  [MiddlewareService.allowedRoles(["headCounsellor", "counsellor"])],
  confirmPassword
);
export default router;
