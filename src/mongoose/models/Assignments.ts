import mongoose, { Schema, Types } from "mongoose";

const AssignmentsSchemaOptions = {
  toJSON: { virtuals: true },
  timestamps: true,
};

export interface ILessonsCompleted {
  lessonId: Types.ObjectId;
  dateCompleted: Date;
}
export interface IAssignments {
  couplesId: Types.ObjectId;
  lessonId: Types.ObjectId;
  uploads: { id: string; name: string }[];
}

const AssignmentsSchema = new Schema<IAssignments>(
  {
    couplesId: { type: Schema.Types.ObjectId },
    lessonId: Schema.Types.ObjectId,
    uploads: [
      {
        id: String,
        name: String,
      },
    ],
  },
  AssignmentsSchemaOptions
);

AssignmentsSchema.virtual("couplesInfo", {
  ref: "Couples",
  localField: "couplesId",
  foreignField: "_id",
});

AssignmentsSchema.virtual("lesson", {
  ref: "Lessons",
  localField: "lessonId",
  foreignField: "_id",
  justOne: true,
});

export const Assignments = mongoose.model<IAssignments>(
  "Assignments",
  AssignmentsSchema
);
