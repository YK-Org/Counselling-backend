import bcrypt from "bcrypt";
import { IUser } from "./../../models/Users";
import { HydratedDocument } from "mongoose";

export default async function hashPassword(user: HydratedDocument<IUser>) {
  if (user && user.isNew) {
    const encryptedUserPassword = await bcrypt.hash(user.password, 10);
    user.password = encryptedUserPassword;
  }

  return user;
}
