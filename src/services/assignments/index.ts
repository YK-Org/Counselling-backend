import prisma from "../../prisma/client";

const lessonInclude = { lesson: { select: { id: true, name: true } } };

class AssignmentsService {
  async getAssignments(query: any = {}) {
    try {
      return await prisma.assignment.findMany({
        where: query,
        orderBy: { createdAt: "desc" },
        include: lessonInclude,
      });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async getAssignment(query: { id: string }) {
    try {
      return await prisma.assignment.findUnique({
        where: { id: query.id },
        include: lessonInclude,
      });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async createAssignment({
    uploads,
    couplesId,
    lessonId,
  }: {
    uploads: { id: string; name: string }[];
    couplesId: string;
    lessonId: string;
  }) {
    try {
      return await prisma.assignment.create({
        data: {
          couplesId,
          lessonId,
          ...(uploads ? { uploads: uploads as any } : {}),
        },
      });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async deleteAssignment(assignmentId: string) {
    try {
      await prisma.assignment.delete({ where: { id: assignmentId } });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
}

export default new AssignmentsService();
