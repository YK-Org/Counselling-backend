import mongoose, { Schema } from "mongoose";

const LessonsSchemaOptions = { toJSON: { virtuals: true }, timestamps: true };

export interface ILessons {
  name: string;
}

const LessonsSchema = new Schema<ILessons>(
  {
    name: { type: String, required: true },
  },
  LessonsSchemaOptions
);

export const Lessons = mongoose.model<ILessons>("Lessons", LessonsSchema);
