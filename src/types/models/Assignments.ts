// Shared types (migrated to Prisma — see prisma/schema.prisma).

export interface IAssignments {
  couplesId: string;
  lessonId: string;
  uploads: { id: string; name: string }[];
}
