import express, { Request, Response } from "express";
import QuestionnaireService from "../services/questionnaire";
import { omit } from "lodash";
import MiddlewareService from "../middleware/index";

const router = express.Router();

const preTest = async (request: Request, response: Response) => {
  try {
    const data = request.body;
    const contact = data["Contact"];
    console.log(" const contact", contact);
    const questions = omit(data, ["Contact", "Name"]);
    const formatQuestions = Object.keys(questions).map((item) => ({
      question: item,
      answer: questions[item],
    }));
    await QuestionnaireService.saveResponse(
      contact,
      formatQuestions,
      "pre-test"
    );
    return response.status(201).json({});
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.post("/questionnaire/pre-test", [], preTest);

const postTest = async (request: Request, response: Response) => {
  try {
    const data = request.body;
    const contact = data["Contact"];
    const questions = omit(data, ["Contact", "Name"]);
    const formatQuestions = Object.keys(questions).map((item) => ({
      question: item,
      answer: questions[item],
    }));
    await QuestionnaireService.saveResponse(
      contact,
      formatQuestions,
      "post-test"
    );
    return response.status(201).json({});
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.post("/questionnaire/post-test", [], postTest);

const getQuestionnaire = async (request: Request, response: Response) => {
  try {
    const coupleId = request.params.coupleId;
    const type = request.params.type as any;
    const data = await QuestionnaireService.getQuestionnaireByType(
      coupleId,
      type
    );
    return response.status(200).json(data);
  } catch (err: any) {
    return response.status(500).json({ message: err.message });
  }
};

router.get(
  "/questionnaire/couples/:coupleId",
  [
    MiddlewareService.canAccessCouple,
    MiddlewareService.allowedRoles(["headCounsellor", "counsellor"]),
  ],
  getQuestionnaire
);

export default router;
