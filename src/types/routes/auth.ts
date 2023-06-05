import express, { Request, Response } from "express";
import bcrypt from "bcrypt";
import AuthService from "../services/auth";
import UserService from "../services/users";
import { LoginValidation } from "../validationClasses/auth/login";
import MiddlewareService from "../middleware/index";
import { RegisterValidation } from "./../validationClasses/auth/register";
import { IRegisterResponse } from "../types/interfaces";

const router = express.Router();

const login = async (request: Request, response: Response) => {
  try {
    const { email, password } = request.body;

    const user = await UserService.getUsers({ email });

    if (user && (await bcrypt.compare(password, user[0].password))) {
      const token = AuthService.generateAccessToken(user[0]);
      response.status(200).send({ token });
    } else {
      throw new Error("Invalid Credentials");
    }
  } catch (error) {
    response.status(400).send(error);
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

    response.status(201).json(user);
  } catch (err) {
    console.log(err);
  }
};

router.post(
  "/register",
  [MiddlewareService.requestValidation(RegisterValidation)],
  register
);

export default router;
