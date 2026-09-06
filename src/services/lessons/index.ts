import prisma from "../../prisma/client";
import { ILessons } from "../../types/models/Lessons";

class LessonsService {
  async createLessons(data: ILessons) {
    try {
      return await prisma.lesson.create({ data: { name: data.name } });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async getLessons() {
    try {
      return await prisma.lesson.findMany({ orderBy: { createdAt: "asc" } });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  // What is pointing at this lesson, so the route can refuse a delete that the
  // database would reject anyway — and explain why.
  async countLessonUsage(lessonId: string) {
    try {
      const [completions, assignments] = await Promise.all([
        prisma.coupleLessonCompleted.count({ where: { lessonId } }),
        prisma.assignment.count({ where: { lessonId } }),
      ]);
      return { completions, assignments };
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async getLesson(query: { id: string }) {
    try {
      return await prisma.lesson.findUnique({ where: { id: query.id } });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async deleteLesson(lessonId: string) {
    try {
      await prisma.lesson.delete({ where: { id: lessonId } });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async countLessons(query: any = {}) {
    try {
      return await prisma.lesson.count({ where: query });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
}

export default new LessonsService();
