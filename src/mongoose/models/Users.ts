import mongoose, { HydratedDocument, Schema } from "mongoose";
import hashPassword from "../hooks/pre/userPassword";

const UserSchemaOptions = { toJSON: { virtuals: true }, timestamps: true };

export type IUserRole = "admin" | "headCounsellor" | "counsellor";
export const userRoles = ["admin", "headCounsellor", "counsellor"];

export type IUserStatus = "active" | "banned";
export const userStatus = ["active", "banned"];

export interface IUser {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phoneNumber: string;
  role: IUserRole;
  status: IUserStatus;
  availability?: boolean;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: { type: String, required: true },
    phoneNumber: { type: String, required: false },
    role: { type: String, enum: userRoles, required: true },
    status: { type: String, enum: userStatus, default: "active" },
    availability: { type: Boolean, required: false },
  },
  UserSchemaOptions
);

UserSchema.pre(
  "save",
  async function (this: HydratedDocument<IUser>, next: any) {
    const user = this;
    await hashPassword(user);
    next();
  }
);

export const User = mongoose.model<IUser>("User", UserSchema);
