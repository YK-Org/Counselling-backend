import express, { Request, Response } from "express";
import bcrypt from "bcrypt";
import AuthService from "../services/auth";
import UserService from "../services/users";
import { LoginValidation } from "../validationClasses/auth/login";
import MiddlewareService from "../middleware/index";
import { RegisterValidation } from "../validationClasses/auth/register";
import { IRegisterResponse } from "../types/interfaces";
import { omit } from "lodash";
import * as jwt from "jsonwebtoken";
import { sendMail } from "../helpers/mailer";
import { passwordRequestMail } from "../helpers/mailTemplate";

const router = express.Router();

const login = async (request: Request, response: Response) => {
  try {
    const { email, password } = request.body;

    const user = await UserService.getUsers({ email });

    if (user && (await bcrypt.compare(password, user[0].password))) {
      const userData: any = {
        ...omit(user[0].toObject(), [
          "password",
          "__v",
          "createdAt",
          "updatedAt",
        ]),
      };
      const token = AuthService.generateAccessToken(userData);
      const data = {
        user: userData,
        token,
      };
      return response.status(200).send(data);
    } else {
      throw new Error("Invalid Credentials");
    }
  } catch (error) {
    return response.status(400).send(error);
  }
};

router.post(
  "/login",
  [MiddlewareService.requestValidation(LoginValidation)],
  login
);

const register = async (request: Request, response: Response) => {
  try {
    const { email } = request.body;

    const oldUser = await UserService.getUsers({ email });

    if (oldUser && oldUser.length) {
      return response.status(409).send("User Already Exists");
    }

    const user = await UserService.createUser(request.body);

    let data = {} as IRegisterResponse;
    if (user) {
      const token = AuthService.generateAccessToken(user);
      data.token = token;
    }

    return response.status(201).json(user);
  } catch (err) {
    console.log(err);
  }
};

router.post(
  "/register",
  [MiddlewareService.requestValidation(RegisterValidation)],
  register
);

const authCheck = async (request: Request, response: Response) => {
  try {
    const authHeader = request.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token == null) return response.status(401);
    const decoded: any = jwt.verify(token, process.env.TOKEN_SECRET as string);
    if (!decoded) {
      return response.status(401);
    }

    const data = {
      ...omit(decoded.user, [
        "password",
        "__v",
        "createdAt",
        "updatedAt",
        "iat",
        "exp",
      ]),
    };
    return response.status(201).json(data);
  } catch (err: any) {
    console.log(err);
    return response.status(401).json({ message: err.message });
  }
};

router.get("/auth/check", authCheck);

const forgotPasswordRequest = async (request: Request, response: Response) => {
  try {
    const email = request.body.email;
    const user = await UserService.getUsers({ email });
    if (user) {
      const userData: any = {
        ...omit(user[0].toObject(), [
          "password",
          "__v",
          "createdAt",
          "updatedAt",
        ]),
      };
      const token = AuthService.generateAccessToken(userData, "900s");
      const link = `${process.env.APP_URL}?tok=${token}`;

      const mailOptions = {
        from: "Counsellor App <counsellortrinity@gmail.com>",
        to: email,
        subject: "Password Reset",
        text: "Testing",
        html: passwordRequestMail(link),
      };
      await sendMail(mailOptions);
      console.log("end");
    } else {
      throw new Error("User cannot be found");
    }
    return response.status(200).send({});
  } catch (error) {
    return response.status(400).send(error);
  }
};

router.post("/forgot-password/request", [], forgotPasswordRequest);

export default router;
