import { Assignments } from "../../mongoose/models/Assignments";

class AssignmentsService {
  async getAssignments(query: any) {
    try {
      const response = await Assignments.find(query)
        .sort({ createdAt: -1 })
        .populate({
          path: "lesson",
          select: "name order",
        });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async getAssignment(query: any) {
    try {
      const response = await Assignments.findOne(query).populate({
        path: "lesson",
        select: "name order",
      });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async createAssignment({
    uploads,
    couplesId,
    lessonId,
  }: {
    uploads: string[];
    couplesId: string;
    lessonId: string;
  }) {
    try {
      const response = await Assignments.create({
        couplesId,
        lessonId,
        uploads,
      });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async deleteAssignment(assignmentId: string) {
    try {
      await Assignments.deleteOne({ _id: assignmentId });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
}

export default new AssignmentsService();
