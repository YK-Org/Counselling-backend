import { Gender } from "@prisma/client";

// Maps what a form respondent might actually pick onto the two values the
// Partner record uses. The questionnaire asks people which of the couple they
// are, and "Husband"/"Wife" reads more naturally on that form than
// "Male"/"Female" — but the database, the intake form and the pre/post
// comparison table are all keyed on gender, so the answer is translated here
// rather than introducing a second way of saying the same thing.
const ALIASES: Record<string, Gender> = {
  male: "male",
  m: "male",
  man: "male",
  husband: "male",
  groom: "male",
  female: "female",
  f: "female",
  woman: "female",
  wife: "female",
  bride: "female",
};

// Returns undefined rather than a guess when the answer is not recognised, so
// a caller treats it as "not stated" and falls back to its other signals
// instead of writing something wrong onto a partner's record.
export const normaliseGender = (input?: string | null): Gender | undefined => {
  if (!input) return undefined;
  return ALIASES[String(input).trim().toLowerCase()];
};
