// NOTE: This project was migrated from MongoDB/Mongoose to Postgres/Prisma.
// These files are retained as the shared TypeScript interfaces/constants that
// the rest of the codebase imports. The persistence layer now lives in Prisma
// (see prisma/schema.prisma and src/prisma/client.ts).

export type IUserRole = "headCounsellor" | "counsellor";
export const userRoles = ["headCounsellor", "counsellor"];

export type IUserStatus = "active" | "banned" | "awaitingConfirmation";
export const userStatus = ["active", "banned", "awaitingConfirmation"];

export interface IUser {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phoneNumber: string;
  role: IUserRole;
  status: IUserStatus;
  availability?: boolean;
  tokenIssuedAt?: number;
  profilePicture?: string;
}
