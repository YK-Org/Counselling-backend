import mongoose, { Schema } from "mongoose";

const LessonsSchemaOptions = { toJSON: { virtuals: true }, timestamps: true };

export interface ILessons {
  name: string;
  order: number;
  uploads?: { id: string; name: string }[];
}

const LessonsSchema = new Schema<ILessons>(
  {
    name: { type: String, required: true },
    order: { type: Number, required: true },
    uploads: [
      {
        id: String,
        name: String,
      },
    ],
  },
  LessonsSchemaOptions
);

export const Lessons = mongoose.model<ILessons>("Lessons", LessonsSchema);
