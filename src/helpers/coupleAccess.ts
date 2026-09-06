import prisma from "../prisma/client";

// One rule for "may this user touch this couple's records", so the couples
// routes, the assignment routes and the media download all answer it the same
// way. A head counsellor oversees everyone; a counsellor sees only the couples
// assigned to them.
export const canAccessCouple = async (
  user: { id: string; role: string } | undefined,
  coupleId: string | null | undefined
): Promise<boolean> => {
  if (!user || !coupleId) return false;
  if (user.role === "headCounsellor") return true;

  const couple = await prisma.couple.findUnique({
    where: { id: coupleId },
    select: { counsellorId: true },
  });

  // A couple that does not exist is refused rather than reported as missing,
  // so this cannot be used to probe which ids are real.
  return Boolean(couple && couple.counsellorId === user.id);
};
