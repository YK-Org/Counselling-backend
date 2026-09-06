// The one password rule, used everywhere a password is set.
//
// There were three before: `POST /change/password` required four character
// classes, `POST /forgot-password/reset` required nothing at all, and the
// portal asked for letters and numbers. The reset endpoint is also the invite
// endpoint, so the path that sets every counsellor's *first* password was the
// one with no check — the weakest rule guarded account creation.
//
// This is the strictest of the three, promoted to be the only one, so nothing
// that was previously accepted anywhere becomes weaker.
const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const PASSWORD_REQUIREMENT_MESSAGE =
  "Password must be at least 8 characters with an uppercase letter, a lowercase letter, a number, and a special character (@$!%*?&)";

// Returns an error message, or null when the password is acceptable.
export const passwordRuleError = (password: unknown): string | null => {
  if (typeof password !== "string" || !password) {
    return "Password is required";
  }
  if (!PASSWORD_PATTERN.test(password)) {
    return PASSWORD_REQUIREMENT_MESSAGE;
  }
  return null;
};
