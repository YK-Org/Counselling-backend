import { Types } from "mongoose";
import { Couples } from "../../mongoose/models/Couples";

class CouplesService {
  async updateWithPartner(_id: Types.ObjectId, newPartnerId: Types.ObjectId) {
    try {
      const response = await Couples.findOneAndUpdate(
        { partners: { $in: _id } },
        { $push: { partners: newPartnerId } }
      );
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async createPartner(ids: Types.ObjectId[], letterPath?: string) {
    try {
      const response = await Couples.create({
        partners: ids,
        ...(letterPath && { letter: letterPath }),
      });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async getUnassignedCouples() {
    try {
      const response = await Couples.find({
        counsellorId: { $exists: false },
      }).populate({
        path: "couplesInfo",
        select: "name",
      });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async countUnassignedCouples() {
    try {
      const response = await Couples.find({
        counsellorId: { $exists: false },
      }).count();
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async countCompletedSessions() {
    try {
      const response = await Couples.find({
        completed: true,
      }).count();
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async getCouples(query: any) {
    try {
      const response = await Couples.find(query)
        .sort({ createdAt: -1 })
        .populate({
          path: "couplesInfo",
          select: "name",
        })
        .populate({
          path: "counsellor",
          select: "firstName lastName",
        });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async getCouple(query: any) {
    try {
      const response = await Couples.findOne(query)
        .populate({
          path: "couplesInfo",
        })
        .populate({
          path: "counsellor",
          select: "firstName lastName",
        });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async updateCoupleLessons(
    _id: Types.ObjectId | String,
    data: { lessonId: Types.ObjectId; dateCompleted: Date }
  ) {
    try {
      const response = await Couples.findByIdAndUpdate(_id, {
        $push: { lessonsCompleted: data },
      });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
}

export default new CouplesService();
