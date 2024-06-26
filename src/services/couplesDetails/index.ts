import { Couples } from "../../mongoose/models/Couples";
import {
  CouplesDetails,
  ICouplesDetails,
} from "../../mongoose/models/CouplesDetails";
import { parsePhoneNumber } from "awesome-phonenumber";

class CouplesDetailsService {
  async createDetails(data: Partial<ICouplesDetails>) {
    try {
      if (data.phoneNumber) {
        data.phoneNumber = parsePhoneNumber(data.phoneNumber).number?.e164;
      }
      const response = await CouplesDetails.create(data);
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async updateDetails(phoneNumber: string, data: any) {
    try {
      const response = await CouplesDetails.findOneAndUpdate(
        { phoneNumber },
        data,
        {
          upsert: true,
          new: true,
        }
      );
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async findPartner(phoneNumber: string, expand?: string[]) {
    try {
      let populate = [];
      if (expand && expand.includes("couple")) {
        populate.push({
          path: "couple",
        });
      }
      phoneNumber = parsePhoneNumber(phoneNumber).number?.e164 || "";
      const response = await CouplesDetails.findOne({ phoneNumber }).populate(
        populate
      );
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async assignCounsellor(coupleId: string, counsellorId: string) {
    try {
      const response = await Couples.findOneAndUpdate(
        { _id: coupleId },
        { counsellorId, counsellorAccepted: "" }
      );
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async acceptDeclineCouple(coupleId: string, acceptDecline: string) {
    try {
      let data = {};
      if (acceptDecline === "accept") {
        data = {
          counsellorAccepted: acceptDecline,
        };
      } else if (acceptDecline === "decline") {
        data = {
          counsellorAccepted: "",
          counsellorId: null,
        };
      }
      const response = await Couples.findOneAndUpdate({ _id: coupleId }, data);
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
}

export default new CouplesDetailsService();
