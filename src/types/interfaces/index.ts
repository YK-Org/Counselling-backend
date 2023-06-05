import { IUser } from "../../mongoose/models/Users";

export interface IRequestUser {}

export interface IRegisterResponse {
  user: IUser;
  token: string;
}
