import { Types } from "mongoose";
import { User } from "../../mongoose/models/Users";
import { IUser } from "./../../mongoose/models/Users";

class UserService {
  async createUser(data: IUser) {
    try {
      const response = await User.create(data);
      return response;
    } catch (e: any) {
      // throw new Error(e.message);
    }
  }

  async updateUser(data: Partial<IUser>, id: Types.ObjectId | string) {
    try {
      const response = await User.findByIdAndUpdate(id, data, { new: true });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async getUser(id: Types.ObjectId | string) {
    try {
      const response = await User.findById(id);
      return response;
    } catch (e: any) {
      // throw new Error(e.message);
    }
  }

  async getUsers(query: any) {
    try {
      const response = await User.find(query);
      return response;
    } catch (e: any) {
      // throw new Error(e.message);
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
      const response = await User.find({
        role: "counsellor",
        availability: true,
        status: "active",
      }).count();
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async getCounsellors() {
    try {
      const response = await User.find({
        role: "counsellor",
      }).populate({
        path: "couples",
        populate: {
          path: "couplesInfo",
          select: "name",
        },
      });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async getCounsellor(query: any) {
    try {
      const response = await User.findById(query).populate({
        path: "couples",
        populate: {
          path: "couplesInfo",
          select: "name",
        },
      });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async searchCounsellors(search: string) {
    try {
      const response = await User.find({
        $or: [
          { lastName: { $regex: search, $options: "i" } },
          { firstName: { $regex: search, $options: "i" } },
        ],
        role: "counsellor",
      });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async createCounsellor(data: IUser) {
    try {
      data.role = "counsellor";
      data.status = "active";
      const response = await User.create(data);
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
}

export default new UserService();
