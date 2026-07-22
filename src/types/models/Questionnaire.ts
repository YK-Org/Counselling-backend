// Shared types (migrated to Prisma — see prisma/schema.prisma).

export interface IResponse {
  question: string;
  answer: string;
}

export interface IQuestionnaire {
  partnerId: string;
  coupleId: string;
  response: IResponse[];
  type: "pre-test" | "post-test";
}
