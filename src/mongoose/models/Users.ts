import mongoose, { HydratedDocument, Schema } from "mongoose";
import hashPassword from "../hooks/pre/userPassword";

const UserSchemaOptions = { toJSON: { virtuals: true }, timestamps: true };

export type IUserRole = "admin" | "headCounsellor" | "counsellor";
export const userRoles = ["admin", "headCounsellor", "counsellor"];

export type IUserStatus = "active" | "banned" | "awaitingConfirmation";
export const userStatus = ["active", "banned", "awaitingConfirmation"];

export interface IUser {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phoneNumber: string;
  role: IUserRole;
  status: IUserStatus;
  availability?: boolean;
  tokenIssuedAt?: number;
  profilePicture?: string;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: { type: String, required: true },
    phoneNumber: { type: String, required: false },
    role: { type: String, enum: userRoles, required: true },
    status: { type: String, enum: userStatus, default: "awaitingConfirmation" },
    availability: { type: Boolean, required: false, default: true },
    tokenIssuedAt: { type: Number, required: true },
    profilePicture: { type: String, required: false },
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

UserSchema.virtual("couples", {
  ref: "Couples",
  localField: "_id",
  foreignField: "counsellorId",
});

// Add indexes for performance
UserSchema.index({ role: 1 });
UserSchema.index({ role: 1, availability: 1 }); // Compound index for counsellor queries
UserSchema.index({ email: 1 }); // Already unique, but explicit index

export const User = mongoose.model<IUser>("User", UserSchema);
