import express, { Request, Response } from "express";
import QuestionnaireService, {
  QuestionnaireType,
} from "../services/questionnaire";
import { omit } from "lodash";
import MiddlewareService from "../middleware/index";
import { requireFormSecret } from "../middleware/formSubmission";
import { handleError, handleValidationError } from "../helpers/errorHandler";

const router = express.Router();

// Fields that identify the respondent rather than answer a question, so they
// are stripped before the rest of the payload becomes question/answer rows.
const META_FIELDS = ["Contact", "Name", "ReferenceCode", "Reference Code"];

const submitQuestionnaire = (type: QuestionnaireType) => {
  return async (request: Request, response: Response) => {
    try {
      const data = request.body || {};
      const contact = data["Contact"];
      const referenceCode = data["ReferenceCode"] ?? data["Reference Code"];

      if (!contact && !referenceCode) {
        return handleValidationError(
          response,
          "A contact number or reference code is required"
        );
      }

      const questions: Record<string, unknown> = omit(data, META_FIELDS);
      const formatQuestions = Object.keys(questions).map((item) => ({
        question: item,
        answer: String(questions[item] ?? ""),
      }));

      const { matched } = await QuestionnaireService.saveResponse(
        contact,
        formatQuestions,
        type,
        referenceCode
      );

      // Mirrors the intake endpoint: the submission is always stored, and the
      // response says whether it reached a couple.
      return response.status(201).json({ matched });
    } catch (err: any) {
      return handleError(
        response,
        err,
        `submitQuestionnaire:${type}`,
        "Could not save submission"
      );
    }
  };
};

router.post(
  "/questionnaire/pre-test",
  [requireFormSecret],
  submitQuestionnaire("pre-test")
);

router.post(
  "/questionnaire/post-test",
  [requireFormSecret],
  submitQuestionnaire("post-test")
);

const QUESTIONNAIRE_TYPES: QuestionnaireType[] = ["pre-test", "post-test"];

const getQuestionnaire = async (request: Request, response: Response) => {
  try {
    const coupleId = request.params.coupleId;
    // The type used to be read from `request.params.type`, which this route
    // never declared — it was always undefined, so the filter did nothing and
    // pre-test and post-test answers came back in one undifferentiated list.
    const type = request.params.type as QuestionnaireType;

    if (!QUESTIONNAIRE_TYPES.includes(type)) {
      return handleValidationError(
        response,
        `type must be one of: ${QUESTIONNAIRE_TYPES.join(", ")}`
      );
    }

    const data = await QuestionnaireService.getQuestionnaireByType(
      coupleId,
      type
    );
    return response.status(200).json(data);
  } catch (err: any) {
    return handleError(
      response,
      err,
      "getQuestionnaire",
      "Failed to fetch questionnaire"
    );
  }
};

router.get(
  "/questionnaire/couples/:coupleId/:type",
  [
    MiddlewareService.canAccessCouple,
    MiddlewareService.allowedRoles(["headCounsellor", "counsellor"]),
  ],
  getQuestionnaire
);

export default router;
