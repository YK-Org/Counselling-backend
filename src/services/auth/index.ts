import * as jwt from "jsonwebtoken";
import { IUser } from "./../../mongoose/models/Users";
import { HydratedDocument } from "mongoose";

class AuthService {
  generateAccessToken = (user: HydratedDocument<IUser>) => {
    const secret = process.env.TOKEN_SECRET ? process.env.TOKEN_SECRET : "";
    return jwt.sign(user.toJSON(), secret, { expiresIn: "86400s" });
  };
}

export default new AuthService();
