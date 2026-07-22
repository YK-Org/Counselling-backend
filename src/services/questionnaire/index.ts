import prisma from "../../prisma/client";
import CouplesDetailsService from "../couplesDetails";

class QuestionnaireService {
  async saveResponse(
    contact: string,
    response: { question: string; answer: string }[],
    type: "pre-test" | "post-test"
  ) {
    try {
      const partner: any = await CouplesDetailsService.findPartner(contact, [
        "couple",
      ]);
      const result = await prisma.questionnaire.create({
        data: {
          type,
          partnerId: partner?.id ?? null,
          coupleId: partner?.couple?.id ?? null,
          responses: {
            create: (response || []).map((r) => ({
              question: r.question,
              answer: r.answer,
            })),
          },
        },
      });
      return result;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async getQuestionnaireByType(
    coupleId: string,
    type: "pre-test" | "post-test"
  ) {
    try {
      const result = await prisma.questionnaire.findMany({
        where: { coupleId, type },
        include: { responses: true },
      });
      // Reconstruct the legacy `response` array shape.
      return result.map((q) => ({
        ...q,
        response: q.responses.map((r) => ({
          question: r.question,
          answer: r.answer,
        })),
      }));
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
}

export default new QuestionnaireService();
