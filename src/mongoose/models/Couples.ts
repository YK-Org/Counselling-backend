import mongoose, { Schema, Types } from "mongoose";
import { ICouplesDetails } from "./CouplesDetails";
import { IUser } from "./Users";
import { ILessons } from "./Lessons";

const CouplesSchemaOptions = { toJSON: { virtuals: true }, timestamps: true };

export interface ICouples {
  counsellorId: Types.ObjectId;
  partners: Types.ObjectId[];
  lessonsCompleted: Types.ObjectId[];
  couplesInfo?: Partial<ICouplesDetails>[];
  counsellor?: Partial<IUser>;
  lessons?: Partial<ILessons>;
  completed: boolean;
}

const CouplesSchema = new Schema<ICouples>(
  {
    counsellorId: { type: Schema.Types.ObjectId },
    partners: [Schema.Types.ObjectId],
    lessonsCompleted: [Schema.Types.ObjectId],
    completed: { type: Boolean, default: false },
  },
  CouplesSchemaOptions
);

CouplesSchema.virtual("couplesInfo", {
  ref: "CouplesDetails",
  localField: "partners",
  foreignField: "_id",
});

CouplesSchema.virtual("counsellor", {
  ref: "User",
  localField: "counsellorId",
  foreignField: "_id",
});

CouplesSchema.virtual("lessons", {
  ref: "Lessons",
  localField: "lessonsCompleted",
  foreignField: "_id",
});

export const Couples = mongoose.model<ICouples>("Couples", CouplesSchema);
