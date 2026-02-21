import mongoose, { Schema, Types } from "mongoose";
import { ICouplesDetails } from "./CouplesDetails";
import { IUser } from "./Users";
import { ILessons } from "./Lessons";

const CouplesSchemaOptions = { toJSON: { virtuals: true }, timestamps: true };

export interface ILessonsCompleted {
  lessonId: Types.ObjectId;
  dateCompleted: Date;
}
export interface ICouples {
  counsellorId: Types.ObjectId;
  partners: Types.ObjectId[];
  lessonsCompleted: Types.ObjectId[];
  couplesInfo?: Partial<ICouplesDetails>[];
  counsellor?: Partial<IUser>;
  lessons?: Partial<ILessons>;
  completed: boolean;
  letter: string;
  counsellorAccepted: String;
}

const LessonsCompletedSchema = new Schema<ILessonsCompleted>({
  lessonId: { type: Schema.Types.ObjectId },
  dateCompleted: { type: Date },
});

const CouplesSchema = new Schema<ICouples>(
  {
    counsellorId: { type: Schema.Types.ObjectId },
    partners: [Schema.Types.ObjectId],
    lessonsCompleted: [LessonsCompletedSchema],
    completed: { type: Boolean, default: false },
    letter: {
      id: String,
      name: String,
    },
    counsellorAccepted: { type: String },
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
  justOne: true,
  foreignField: "_id",
});

CouplesSchema.virtual("lessons", {
  ref: "Lessons",
  localField: "lessonsCompleted",
  foreignField: "_id",
});

// Add indexes for performance
CouplesSchema.index({ counsellorId: 1 });
CouplesSchema.index({ completed: 1 });
CouplesSchema.index({ createdAt: -1 });
CouplesSchema.index({ updatedAt: -1 });
CouplesSchema.index({ counsellorId: 1, completed: 1 }); // Compound index

export const Couples = mongoose.model<ICouples>("Couples", CouplesSchema);
