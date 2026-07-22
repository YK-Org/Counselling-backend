import { IUser } from "../models/Users";

export interface IRequestUser {}

export interface IRegisterResponse {
  user: IUser;
  token: string;
}
