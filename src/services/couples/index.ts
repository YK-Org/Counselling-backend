import prisma from "../../prisma/client";

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
    try {
      const response = await prisma.couple.create({
        data: {
          ...(letterPath
            ? { letterFileId: letterPath.id, letterFileName: letterPath.name }
            : {}),
          partners: { connect: ids.map((id) => ({ id })) },
        },
      });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
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

  async getCouples(query: any) {
    try {
      const response = await prisma.couple.findMany({
        where: query,
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
