import { IForms, Forms } from "../../mongoose/models/Forms";

class FormsService {
  async createForms(data: IForms) {
    try {
      const response = await Forms.create(data);
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
  async getForms(query: any) {
    try {
      const response = await Forms.find(query);
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
}

export default new FormsService();
