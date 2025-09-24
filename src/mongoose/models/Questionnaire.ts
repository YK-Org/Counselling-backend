import mongoose, { HydratedDocument, Schema } from "mongoose";

const QuestionnaireSchemaOptions = {
  toJSON: { virtuals: true },
  timestamps: true,
};

export interface IResponse {
  question: string;
  answer: string;
}

export interface IQuestionnaire {
  partnerId: string;
  coupleId: string;
  response: IResponse[];
  type: "pre-test" | "post-test";
}

const ResponseSchema = new Schema<IResponse>({
  question: { type: String, required: true, unique: true },
  answer: { type: String, required: true },
});

const QuestionnaireSchema = new Schema<IQuestionnaire>(
  {
    partnerId: { type: String, required: true },
    coupleId: { type: String, required: true },
    response: [ResponseSchema],
    type: { type: String, required: true },
  },
  QuestionnaireSchemaOptions
);

export const Questionnaire = mongoose.model<IQuestionnaire>(
  "Questionnaire",
  QuestionnaireSchema
);
