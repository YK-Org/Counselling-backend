// Shared types (migrated to Prisma — see prisma/schema.prisma).
import { ICouplesDetails } from "./CouplesDetails";
import { IUser } from "./Users";
import { ILessons } from "./Lessons";

export interface ILessonsCompleted {
  lessonId: string;
  dateCompleted: Date;
}

export interface ICouples {
  counsellorId: string;
  partners: string[];
  lessonsCompleted: string[];
  couplesInfo?: Partial<ICouplesDetails>[];
  counsellor?: Partial<IUser>;
  lessons?: Partial<ILessons>;
  completed: boolean;
  letter: string;
  counsellorAccepted: String;
}
