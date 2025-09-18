import { IResources, Resources } from "../../mongoose/models/Resources";

class ResourcesService {
  async createResources(data: IResources) {
    try {
      const response = await Resources.create(data);
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
  async getResources(query: any) {
    try {
      const response = await Resources.find(query).sort({ order: 1 });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async getLesson(query: any) {
    try {
      const response = await Resources.findOne(query);
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async deleteLesson(resourceId: string) {
    try {
      await Resources.deleteOne({ _id: resourceId });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async countResources(query = {}) {
    try {
      const response = await Resources.find(query).count();
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
}

export default new ResourcesService();
