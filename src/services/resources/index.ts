import prisma from "../../prisma/client";
import { IResources } from "../../types/models/Resources";

class ResourcesService {
  async createResources(data: IResources) {
    try {
      return await prisma.resource.create({
        data: {
          name: data.name,
          ...(data.uploads ? { uploads: data.uploads as any } : {}),
        },
      });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async getResources(query: any = {}) {
    try {
      return await prisma.resource.findMany({
        where: query,
        orderBy: { createdAt: "asc" },
      });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async getLesson(query: { id: string }) {
    try {
      return await prisma.resource.findUnique({ where: { id: query.id } });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async deleteLesson(resourceId: string) {
    try {
      await prisma.resource.delete({ where: { id: resourceId } });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async countResources(query: any = {}) {
    try {
      return await prisma.resource.count({ where: query });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
}

export default new ResourcesService();
