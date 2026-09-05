import prisma from "../../prisma/client";
import { generateReferenceCode } from "../../helpers/referenceCode";

// Reconstruct the legacy (Mongo) response shape the frontend expects:
//  - partners            -> couplesInfo
//  - CoupleLessonCompleted rows -> lessonsCompleted [{ lessonId, dateCompleted }]
//  - letterFileId/Name   -> letter { id, name }
//  - each partner's questionnaires -> questionnaire [{ response, type }]
const shapePartner = (partner: any) => {
  if (!partner) return partner;
  const { questionnaires, ...rest } = partner;
  if (!questionnaires) return rest;
  return {
    ...rest,
    questionnaire: questionnaires.map((q: any) => ({
      type: q.type,
      response: (q.responses || []).map((r: any) => ({
        question: r.question,
        answer: r.answer,
      })),
    })),
  };
};

const shapeCouple = (couple: any) => {
  if (!couple) return couple;
  const { partners, lessonsCompleted, letterFileId, letterFileName, ...rest } =
    couple;
  return {
    ...rest,
    couplesInfo: (partners || []).map(shapePartner),
    lessonsCompleted: (lessonsCompleted || []).map((l: any) => ({
      lessonId: l.lessonId,
      dateCompleted: l.dateCompleted,
    })),
    ...(letterFileId
      ? { letter: { id: letterFileId, name: letterFileName } }
      : {}),
  };
};

const counsellorSelect = {
  select: { id: true, firstName: true, lastName: true },
};

// The only filters the couples list accepts. Anything else in the query string
// is dropped by the route before it reaches Prisma.
export type CouplesFilter = {
  counsellorId?: string | null;
  counsellorAccepted?: string;
  completed?: boolean;
};

class CouplesService {
  // Add a new partner to the couple that already contains `existingPartnerId`.
  async updateWithPartner(existingPartnerId: string, newPartnerId: string) {
    try {
      const existing = await prisma.partner.findUnique({
        where: { id: existingPartnerId },
        select: { coupleId: true },
      });
      if (existing?.coupleId) {
        await prisma.partner.update({
          where: { id: newPartnerId },
          data: { coupleId: existing.coupleId },
        });
      }
      return existing;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async createPartner(
    ids: string[],
    letterPath?: { id: string; name: string }
  ) {
    // Codes are random rather than sequential, so a collision is possible even
    // though it is rare. Retry against the unique constraint instead of
    // trusting the draw.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await prisma.couple.create({
          data: {
            referenceCode: generateReferenceCode(),
            ...(letterPath
              ? { letterFileId: letterPath.id, letterFileName: letterPath.name }
              : {}),
            partners: { connect: ids.map((id) => ({ id })) },
          },
        });
      } catch (e: any) {
        const isCodeCollision =
          e?.code === "P2002" &&
          (e?.meta?.target as string[] | undefined)?.includes("referenceCode");
        if (!isCodeCollision) throw new Error(e.message);
      }
    }
    throw new Error("Could not allocate a unique reference code");
  }

  async getCoupleByReferenceCode(referenceCode: string) {
    try {
      return await prisma.couple.findUnique({
        where: { referenceCode },
        include: { partners: true },
      });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  // Submissions that could not be attached to a couple, newest first. These are
  // the ones a head counsellor has to resolve by hand: a mistyped code, a
  // partner who has not submitted yet, or a number that does not match.
  async getUnmatchedSubmissions() {
    try {
      return await prisma.partner.findMany({
        where: { coupleId: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          gender: true,
          partner: true,
          formSubmittedAt: true,
          createdAt: true,
        },
      });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  // Couples where at least one partner has registered but not everyone has
  // sent their form in. Shown alongside the unmatched list so the dashboard
  // reflects everything still outstanding.
  async getCouplesAwaitingForms() {
    try {
      const couples = await prisma.couple.findMany({
        where: { partners: { some: { formSubmittedAt: null } } },
        include: {
          partners: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              gender: true,
              formSubmittedAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return couples.map((couple) => ({
        id: couple.id,
        referenceCode: couple.referenceCode,
        createdAt: couple.createdAt,
        partners: couple.partners,
        awaiting: couple.partners.filter((p) => !p.formSubmittedAt).length,
      }));
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  // Attaches an unmatched submission to a couple, either an existing one or a
  // new couple formed with another unmatched submission.
  async pairSubmissions(partnerId: string, target: { coupleId?: string; otherPartnerId?: string }) {
    return prisma.$transaction(async (tx) => {
      const partner = await tx.partner.findUnique({ where: { id: partnerId } });
      if (!partner) throw new Error("Submission not found");
      if (partner.coupleId) throw new Error("Submission is already paired");

      if (target.coupleId) {
        const couple = await tx.couple.findUnique({
          where: { id: target.coupleId },
          include: { partners: true },
        });
        if (!couple) throw new Error("Couple not found");
        if (couple.partners.length >= 2) {
          throw new Error("That couple already has two partners");
        }
        await tx.partner.update({
          where: { id: partnerId },
          data: { coupleId: couple.id },
        });
        return couple.id;
      }

      const other = await tx.partner.findUnique({
        where: { id: target.otherPartnerId as string },
      });
      if (!other) throw new Error("Other submission not found");
      if (other.coupleId) throw new Error("Other submission is already paired");
      if (other.id === partnerId) {
        throw new Error("Cannot pair a submission with itself");
      }

      const couple = await tx.couple.create({
        data: {
          referenceCode: generateReferenceCode(),
          partners: { connect: [{ id: partnerId }, { id: other.id }] },
        },
      });
      return couple.id;
    });
  }

  async getUnassignedCouples() {
    try {
      const response = await prisma.couple.findMany({
        where: { counsellorId: null },
        include: { partners: { select: { id: true, name: true } } },
      });
      return response.map(shapeCouple);
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async countUnassignedCouples() {
    try {
      return await prisma.couple.count({ where: { counsellorId: null } });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async countCompletedSessions() {
    try {
      return await prisma.couple.count({ where: { completed: true } });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  // The filter is built by the route from a fixed whitelist, never handed
  // straight through from the query string — `where` accepts nested Prisma
  // operators, so an unfiltered query string let a caller write filters like
  // `partners.some.phoneNumber.contains` and enumerate counsellees.
  async getCouples(filter: CouplesFilter) {
    try {
      const response = await prisma.couple.findMany({
        where: filter,
        orderBy: { createdAt: "desc" },
        include: {
          partners: { select: { id: true, name: true } },
          counsellor: counsellorSelect,
          lessonsCompleted: true,
        },
      });
      return response.map(shapeCouple);
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  // Look up a couple by its id, or by a partner it contains.
  async getCouple(query: { id?: string; partnerId?: string }) {
    try {
      let where: any = {};
      if (query.id) {
        where = { id: query.id };
      } else if (query.partnerId) {
        where = { partners: { some: { id: query.partnerId } } };
      }

      const response = await prisma.couple.findFirst({
        where,
        include: {
          partners: {
            include: {
              questionnaires: { include: { responses: true } },
            },
          },
          counsellor: counsellorSelect,
          lessonsCompleted: true,
        },
      });
      return shapeCouple(response);
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async updateCoupleLessons(
    coupleId: string,
    data: { lessonId: string; dateCompleted: Date }
  ) {
    try {
      const response = await prisma.coupleLessonCompleted.upsert({
        where: {
          coupleId_lessonId: { coupleId, lessonId: data.lessonId },
        },
        create: {
          coupleId,
          lessonId: data.lessonId,
          ...(data.dateCompleted ? { dateCompleted: data.dateCompleted } : {}),
        },
        update: {
          ...(data.dateCompleted ? { dateCompleted: data.dateCompleted } : {}),
        },
      });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
}

export default new CouplesService();
