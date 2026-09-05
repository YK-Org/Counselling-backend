import prisma from "../../prisma/client";
import CouplesDetailsService from "../couplesDetails";
import { toE164 } from "../../helpers/phoneNumber";
import { normaliseReferenceCode } from "../../helpers/referenceCode";

export type QuestionnaireType = "pre-test" | "post-test";

class QuestionnaireService {
  // Works out which partner (and couple) a questionnaire belongs to.
  //
  // Matching used to be phone-only: a number that did not match anything
  // produced a row with both partnerId and coupleId null, the endpoint still
  // answered 201, and the responses were unreachable from every screen in the
  // app. The intake form was given reference codes for exactly this reason, so
  // the questionnaires now use them too and fall back to phone as before.
  private async resolveOwner(contact: string, referenceCode?: string) {
    const code = normaliseReferenceCode(referenceCode);

    if (code) {
      const couple = await prisma.couple.findUnique({
        where: { referenceCode: code },
        include: { partners: { select: { id: true, phoneNumber: true } } },
      });

      if (couple) {
        // The code identifies the couple with certainty. The phone then picks
        // which of the two partners answered; if it matches neither, the
        // responses still attach to the couple rather than falling on the
        // floor, and a person can tell the partners apart from the answers.
        const phone = toE164(contact);
        const partner = phone
          ? couple.partners.find((p) => p.phoneNumber === phone)
          : undefined;
        return { partnerId: partner?.id ?? null, coupleId: couple.id };
      }
    }

    const partner: any = await CouplesDetailsService.findPartner(contact, [
      "couple",
    ]);
    return {
      partnerId: partner?.id ?? null,
      coupleId: partner?.couple?.id ?? null,
    };
  }

  async saveResponse(
    contact: string,
    response: { question: string; answer: string }[],
    type: QuestionnaireType,
    referenceCode?: string
  ) {
    try {
      const { partnerId, coupleId } = await this.resolveOwner(
        contact,
        referenceCode
      );

      const result = await prisma.questionnaire.create({
        data: {
          type,
          partnerId,
          coupleId,
          responses: {
            create: (response || []).map((r) => ({
              question: r.question,
              answer: r.answer,
            })),
          },
        },
      });

      if (!coupleId) {
        // Saved, but attached to nobody, so it appears on no couple's page.
        // Loud in the logs because nothing else will surface it.
        console.warn(
          "questionnaire: submission could not be matched to a couple",
          { type, questionnaireId: result.id, hasReferenceCode: Boolean(referenceCode) }
        );
      }

      return { questionnaire: result, matched: Boolean(coupleId) };
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async getQuestionnaireByType(coupleId: string, type: QuestionnaireType) {
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
