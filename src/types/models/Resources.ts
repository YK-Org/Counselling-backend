// Shared types (migrated to Prisma — see prisma/schema.prisma).

export interface IResources {
  name: string;
  uploads?: { id: string; name: string }[];
}
