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

  async createPartner(_id: Types.ObjectId) {
    try {
      const response = await Couples.create({
        partners: [_id],
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
}

export default new CouplesService();