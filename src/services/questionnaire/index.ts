import prisma from "../../prisma/client";
import CouplesDetailsService from "../couplesDetails";
import { toE164 } from "../../helpers/phoneNumber";
import { normaliseReferenceCode } from "../../helpers/referenceCode";
import { normaliseGender } from "../../helpers/gender";

export type QuestionnaireType = "pre-test" | "post-test";

export type QuestionnaireSubmission = {
  contact?: string;
  name?: string;
  referenceCode?: string;
  gender?: string;
};

type Resolution = {
  partnerId: string | null;
  coupleId: string | null;
  // Why a submission ended up unlinked, for the queue to explain itself.
  reason?: "no-code-match" | "ambiguous-partner" | "partner-not-identified";
};

class QuestionnaireService {
  // Works out which partner (and couple) a questionnaire belongs to.
  //
  // The couple comes from the reference code both partners are given, which is
  // the same mechanism the intake form uses. Which of the two partners it is
  // comes from the gender question on the form, because gender is already the
  // discriminator everywhere else: registration creates one male and one
  // female slot, and the pre/post comparison table is built by finding each.
  //
  // The phone number is a cross-check, not the key. It used to be the only
  // signal, which meant anyone who typed a different number from the one on
  // file had their answers silently attached to nobody.
  private async resolveOwner(
    submission: QuestionnaireSubmission
  ): Promise<Resolution> {
    const code = normaliseReferenceCode(submission.referenceCode);
    const gender = normaliseGender(submission.gender);
    const phone = toE164(submission.contact);

    if (code) {
      const couple = await prisma.couple.findUnique({
        where: { referenceCode: code },
        include: { partners: { select: { id: true, phoneNumber: true, gender: true } } },
      });

      if (couple) {
        const byGender = gender
          ? couple.partners.find((p) => p.gender === gender)
          : undefined;
        const byPhone = phone
          ? couple.partners.find((p) => p.phoneNumber === phone)
          : undefined;

        // Both signals present and pointing at different people. Guessing here
        // would attach one spouse's answers about sex, abuse and health to the
        // other, so it goes to the queue instead. The couple is still certain,
        // which is most of what a person needs to resolve it.
        if (byGender && byPhone && byGender.id !== byPhone.id) {
          return {
            partnerId: null,
            coupleId: couple.id,
            reason: "ambiguous-partner",
          };
        }

        const partner = byGender || byPhone;
        if (partner) return { partnerId: partner.id, coupleId: couple.id };

        // Right couple, but nothing identifies which half of it.
        return {
          partnerId: null,
          coupleId: couple.id,
          reason: "partner-not-identified",
        };
      }
    }

    // No code, or a code matching no couple. Fall back to the phone lookup the
    // endpoint has always used, which still covers every form sent before
    // codes existed.
    if (submission.contact) {
      const partner: any = await CouplesDetailsService.findPartner(
        submission.contact,
        ["couple"]
      );
      if (partner) {
        return {
          partnerId: partner.id,
          coupleId: partner.couple?.id ?? null,
        };
      }
    }

    return { partnerId: null, coupleId: null, reason: "no-code-match" };
  }

  async saveResponse(
    submission: QuestionnaireSubmission,
    response: { question: string; answer: string }[],
    type: QuestionnaireType
  ) {
    try {
      const { partnerId, coupleId, reason } = await this.resolveOwner(
        submission
      );

      const result = await prisma.questionnaire.create({
        data: {
          type,
          partnerId,
          coupleId,
          // Stored verbatim so an unlinked submission can still be identified
          // by a person. The answers alone say nothing about who sent them.
          submittedContact: submission.contact || null,
          submittedName: submission.name || null,
          submittedReferenceCode: submission.referenceCode || null,
          submittedGender: submission.gender || null,
          responses: {
            create: (response || []).map((r) => ({
              question: r.question,
              answer: r.answer,
            })),
          },
        },
      });

      // A row with no partner appears on no couple's page, because the app
      // loads questionnaires through the partner relation. It is recoverable
      // only from the outstanding-submissions queue.
      if (!partnerId) {
        console.warn("questionnaire: submission is unlinked", {
          type,
          questionnaireId: result.id,
          reason,
          coupleId,
        });
      }

      return { questionnaire: result, matched: Boolean(partnerId), reason };
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

  // Submissions that reached no partner, so appear on no couple's page.
  async getUnlinkedQuestionnaires() {
    try {
      const rows = await prisma.questionnaire.findMany({
        where: { partnerId: null },
        orderBy: { createdAt: "desc" },
        include: {
          couple: {
            select: {
              id: true,
              referenceCode: true,
              partners: { select: { id: true, name: true, gender: true } },
            },
          },
          responses: { select: { question: true, answer: true } },
        },
      });

      return rows.map((row) => ({
        id: row.id,
        type: row.type,
        createdAt: row.createdAt,
        submittedContact: row.submittedContact,
        submittedName: row.submittedName,
        submittedReferenceCode: row.submittedReferenceCode,
        submittedGender: row.submittedGender,
        answerCount: row.responses.length,
        // When the code matched, the couple is known and only the partner is
        // in doubt — the two candidates come with it so the choice is a
        // two-way pick rather than a search.
        couple: row.couple
          ? {
              id: row.couple.id,
              referenceCode: row.couple.referenceCode,
              partners: row.couple.partners,
            }
          : null,
      }));
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  // Attaches an unlinked submission to a partner, which is what makes it
  // visible on that couple's page.
  async linkToPartner(questionnaireId: string, partnerId: string) {
    return prisma.$transaction(async (tx) => {
      const questionnaire = await tx.questionnaire.findUnique({
        where: { id: questionnaireId },
      });
      if (!questionnaire) throw new Error("Submission not found");
      if (questionnaire.partnerId) {
        throw new Error("Submission is already linked");
      }

      const partner = await tx.partner.findUnique({
        where: { id: partnerId },
        select: { id: true, coupleId: true },
      });
      if (!partner) throw new Error("Partner not found");
      if (!partner.coupleId) {
        // Linking to a partner with no couple would hide the submission again,
        // since the page is reached through the couple.
        throw new Error("That partner is not part of a couple yet");
      }

      return tx.questionnaire.update({
        where: { id: questionnaireId },
        data: { partnerId: partner.id, coupleId: partner.coupleId },
      });
    });
  }
}

export default new QuestionnaireService();
