import prisma from "../../prisma/client";
import { IForms } from "../../types/models/Forms";

class FormsService {
  async createForms(data: IForms) {
    try {
      return await prisma.form.create({
        data: { name: data.name, link: data.link },
      });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async getForms(query: any = {}) {
    try {
      return await prisma.form.findMany({ where: query });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
}

export default new FormsService();
