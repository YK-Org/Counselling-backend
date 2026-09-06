import express, { Request, Response } from "express";
import QuestionnaireService, {
  QuestionnaireType,
} from "../services/questionnaire";
import { removeUnwantedCharacters } from "../helpers/removeUnwantedCharacters";
import MiddlewareService from "../middleware/index";
import { requireFormSecret } from "../middleware/formSubmission";
import { handleError, handleValidationError } from "../helpers/errorHandler";
import { AuthenticatedRequest } from "../types";
import AuditService, { AUDIT_ACTIONS } from "../services/audit";

const router = express.Router();

// Fields that identify the respondent rather than answer a question, so they
// are stripped before the rest of the payload becomes question/answer rows.
//
// Titles are compared with spaces, full stops, apostrophes, question marks and
// slashes removed, and case ignored — the same normalisation the intake form
// applies via removeUnwantedCharacters. Without it these would have to match a
// Google Form title character for character, and the live intake form already
// has questions titled "Tel. No" and "Profession/Occupation", so exact
// matching is not a workable assumption.
const FIELD_ALIASES = {
  contact: ["Contact", "Phone", "Phone Number", "Tel. No", "TelNo"],
  name: ["Name", "Full Name"],
  referenceCode: ["Reference Code", "Couple Code"],
  gender: [
    "Gender",
    "Are you the husband or wife?",
    "Which of you is filling this in?",
    "Husband or Wife",
    "Role",
  ],
};

const normaliseKey = (key: string) =>
  removeUnwantedCharacters(String(key)).toLowerCase();

// Built once: normalised title -> which identifying field it supplies.
const FIELD_BY_KEY = new Map<string, keyof typeof FIELD_ALIASES>();
for (const [field, titles] of Object.entries(FIELD_ALIASES)) {
  for (const title of titles) {
    FIELD_BY_KEY.set(normaliseKey(title), field as keyof typeof FIELD_ALIASES);
  }
}

// Splits a submission into the fields that say who sent it and the answers.
const partitionSubmission = (data: Record<string, any>) => {
  const submission: Record<string, string | undefined> = {};
  const answers: { question: string; answer: string }[] = [];

  for (const [key, raw] of Object.entries(data)) {
    const field = FIELD_BY_KEY.get(normaliseKey(key));
    const value = raw === undefined || raw === null ? "" : String(raw).trim();

    if (field) {
      // First non-empty wins, so a form carrying two spellings of the same
      // thing does not lose the answered one to the blank one.
      if (value && !submission[field]) submission[field] = value;
      continue;
    }

    answers.push({ question: key, answer: value });
  }

  return { submission, answers };
};

const submitQuestionnaire = (type: QuestionnaireType) => {
  return async (request: Request, response: Response) => {
    try {
      const data = request.body || {};
      const { submission, answers } = partitionSubmission(data);

      if (!submission.contact && !submission.referenceCode) {
        return handleValidationError(
          response,
          "A reference code or contact number is required"
        );
      }

      const { matched, reason } = await QuestionnaireService.saveResponse(
        submission,
        answers,
        type
      );

      // Always stored. `matched` says whether it reached a partner and is
      // therefore visible on a couple's page; if not, it is in the queue.
      return response.status(201).json({ matched, ...(reason ? { reason } : {}) });
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

    AuditService.track({
      action: AUDIT_ACTIONS.QUESTIONNAIRE_VIEWED,
      actor: (request as AuthenticatedRequest).user,
      targetType: "couple",
      targetId: coupleId,
      request,
      metadata: { type },
    });

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

const linkQuestionnaire = async (request: Request, response: Response) => {
  try {
    const { questionnaireId } = request.params;
    const { partnerId } = request.body;

    if (!partnerId) {
      return handleValidationError(response, "partnerId is required");
    }

    const data = await QuestionnaireService.linkToPartner(
      questionnaireId,
      partnerId
    );

    AuditService.track({
      action: AUDIT_ACTIONS.QUESTIONNAIRE_LINKED,
      actor: (request as AuthenticatedRequest).user,
      targetType: "questionnaire",
      targetId: questionnaireId,
      request,
      metadata: { partnerId },
    });

    return response.status(200).json(data);
  } catch (err: any) {
    // Already linked, unknown partner, partner with no couple — all states a
    // person can correct, not server faults.
    return handleValidationError(response, err.message);
  }
};

router.put(
  "/questionnaire/:questionnaireId/link",
  [MiddlewareService.allowedRoles(["headCounsellor"])],
  linkQuestionnaire
);

export default router;
