import bcrypt from "bcrypt";
import prisma from "../../prisma/client";
import { IUser } from "../../types/models/Users";

// Shape a counsellor's couples into the legacy `couplesInfo` structure the
// frontend expects (partners were previously exposed under that virtual).
const shapeCounsellor = (counsellor: any) => {
  if (!counsellor) return counsellor;
  const { couples, ...rest } = counsellor;
  return {
    ...rest,
    couples: (couples || []).map((couple: any) => {
      const { partners, ...coupleRest } = couple;
      return { ...coupleRest, couplesInfo: partners };
    }),
  };
};

class UserService {
  async createUser(data: Partial<IUser>) {
    try {
      const password = await bcrypt.hash(data.password as string, 10);
      const response = await prisma.user.create({
        data: {
          email: data.email as string,
          firstName: data.firstName as string,
          lastName: data.lastName as string,
          password,
          phoneNumber: data.phoneNumber,
          role: (data.role as any) || "counsellor",
          ...(data.status ? { status: data.status as any } : {}),
        },
      });
      return response;
    } catch (e: any) {
      // Preserve previous behaviour: swallow create errors and return undefined.
    }
  }

  async updateUser(data: any, id: string) {
    try {
      const response = await prisma.user.update({
        where: { id },
        data,
      });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async getUser(id: string) {
    try {
      const response = await prisma.user.findUnique({ where: { id } });
      return response;
    } catch (e: any) {
      // Preserve previous behaviour: return undefined on error.
    }
  }

  async getUsers(query: any) {
    try {
      const response = await prisma.user.findMany({ where: query });
      return response;
    } catch (e: any) {
      // Preserve previous behaviour: return undefined on error.
    }
  }

  async deleteUser() {
    try {
    } catch (e: any) {
      // throw new Error(e.message);
    }
  }

  async countAvailableCounsellors() {
    try {
      const response = await prisma.user.count({
        where: { role: "counsellor", availability: true, status: "active" },
      });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async getCounsellors() {
    try {
      const response = await prisma.user.findMany({
        where: { role: "counsellor" },
        include: {
          couples: {
            include: {
              partners: { select: { id: true, name: true } },
            },
          },
        },
      });
      return response.map(shapeCounsellor);
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async getCounsellor(query: { id: string }) {
    try {
      const response = await prisma.user.findUnique({
        where: { id: query.id },
        include: {
          couples: {
            include: {
              partners: { select: { id: true, name: true } },
            },
          },
        },
      });
      return shapeCounsellor(response);
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async searchCounsellors(search: string) {
    try {
      const response = await prisma.user.findMany({
        where: {
          role: "counsellor",
          OR: [
            { lastName: { contains: search, mode: "insensitive" } },
            { firstName: { contains: search, mode: "insensitive" } },
          ],
        },
      });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async createCounsellor(data: Partial<IUser>) {
    try {
      const password = await bcrypt.hash(data.password as string, 10);
      const response = await prisma.user.create({
        data: {
          email: data.email as string,
          firstName: data.firstName as string,
          lastName: data.lastName as string,
          password,
          phoneNumber: data.phoneNumber,
          role: "counsellor",
          status: "active",
        },
      });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
}

export default new UserService();
