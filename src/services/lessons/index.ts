import { ILessons, Lessons } from "../../mongoose/models/Lessons";

class LessonsService {
  async createLessons(data: ILessons) {
    try {
      const response = await Lessons.create(data);
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
  async getLessons(query: any) {
    try {
      const response = await Lessons.find(query);
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
  async countLessons(query = {}) {
    try {
      const response = await Lessons.find(query).count();
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
}

export default new LessonsService();
