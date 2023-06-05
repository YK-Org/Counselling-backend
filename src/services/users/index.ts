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

  async updateUser(
    data: IUser,
    id: Types.ObjectId
  ) {
    try {
      const response = await User.findByIdAndUpdate(id, data);
      return response;
    } catch (e: any) {
      // throw new Error(e.message);
    }
  }

  async getUser(id: Types.ObjectId) {
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
}

export default new UserService();
