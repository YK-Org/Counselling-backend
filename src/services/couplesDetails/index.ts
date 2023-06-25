import { Couples } from "../../mongoose/models/Couples";
import {
  CouplesDetails,
  ICouplesDetails,
} from "../../mongoose/models/CouplesDetails";

class CouplesDetailsService {
  async createDetails(data: ICouplesDetails) {
    try {
      const response = await CouplesDetails.create(data);
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async findPartner(phoneNumber: string) {
    try {
      const response = await CouplesDetails.findOne({ phoneNumber });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async assignCounsellor(coupleId: string, counsellorId: string) {
    try {
      const response = await Couples.findOneAndUpdate(
        { _id: coupleId },
        { counsellorId }
      );
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
}

export default new CouplesDetailsService();
