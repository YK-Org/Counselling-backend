import mongoose, { Schema } from "mongoose";

const FormsSchemaOptions = { toJSON: { virtuals: true }, timestamps: true };

export interface IForms {
  name: string;
  link: string;
}

const FormsSchema = new Schema<IForms>(
  {
    name: { type: String, required: true },
    link: { type: String, required: true },
  },
  FormsSchemaOptions
);

export const Forms = mongoose.model<IForms>("Forms", FormsSchema);
