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

  async getLessons(query: any = {}) {
    try {
      return await prisma.lesson.findMany({ where: query });
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
