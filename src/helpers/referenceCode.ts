import crypto from "crypto";

// Excludes characters people confuse when reading a code off paper or a screen:
// O and 0, I/L and 1, S and 5. Both halves of each pair are left out, so a
// misread can never silently resolve to a different valid code — it fails and
// the submission lands in the unmatched queue instead.
const ALPHABET = "ACDEFGHJKMNPQRTUVWXYZ2346789";
const CODE_LENGTH = 6;

// The one pair kept deliberately: 8 is in the alphabet and B is not, so a "B"
// can only ever be a misread 8 and is safe to correct.
const SAFE_SUBSTITUTIONS: Record<string, string> = { B: "8" };

const format = (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`;

export function generateReferenceCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return format(code);
}

// Accepts what a respondent actually types: lower case, missing or extra
// hyphens, surrounding spaces. Returns null when the input cannot be a valid
// code, which the caller treats as "no code given" rather than guessing.
export function normaliseReferenceCode(input?: string | null) {
  if (!input) return null;

  const cleaned = input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .split("")
    .map((character) => SAFE_SUBSTITUTIONS[character] || character)
    .join("");

  if (cleaned.length !== CODE_LENGTH) return null;
  if (![...cleaned].every((character) => ALPHABET.includes(character))) {
    return null;
  }

  return format(cleaned);
}
