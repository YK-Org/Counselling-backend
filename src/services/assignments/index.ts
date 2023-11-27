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
    assignmentPath,
    couplesId,
    lessonsId,
  }: {
    assignmentPath: string[];
    couplesId: string;
    lessonsId: string;
  }) {
    try {
      const response = await Assignments.create({
        couplesId,
        lessonsId,
        uploads: assignmentPath,
      });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
}

export default new AssignmentsService();
