import { Questionnaire } from "../../mongoose/models/Questionnaire";
import CouplesDetailsService from "../couplesDetails";

class QuestionnaireService {
  async saveResponse(
    contact: string,
    response: any[],
    type: "pre-test" | "post-test"
  ) {
    try {
      const data = await CouplesDetailsService.findPartner(contact);

      const result = await Questionnaire.create({
        partnerId: data?._id,
        coupleId: data?.couple?._id,
        response,
      });
      return result;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
}

export default new QuestionnaireService();
