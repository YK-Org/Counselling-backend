import mongoose, { Schema } from "mongoose";

const ResourcesSchemaOptions = { toJSON: { virtuals: true }, timestamps: true };

export interface IResources {
  name: string;
  uploads?: { id: string; name: string }[];
}

const ResourcesSchema = new Schema<IResources>(
  {
    name: { type: String, required: true },
    uploads: [
      {
        id: String,
        name: String,
      },
    ],
  },
  ResourcesSchemaOptions
);

export const Resources = mongoose.model<IResources>(
  "Resources",
  ResourcesSchema
);
