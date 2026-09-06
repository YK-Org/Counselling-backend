import { buildCouplesFilter } from "../../src/routes/couples";
import { passwordRuleError } from "../../src/helpers/password";

// The couples list once passed the query string to Prisma as `where` verbatim,
// which both skipped every access check and accepted arbitrary nested
// operators. These pin the two properties that replaced it: a counsellor is
// confined to their own couples whatever they ask for, and nothing outside a
// fixed whitelist reaches the database.

const counsellor = { id: "u-counsellor", role: "counsellor" };
const head = { id: "u-head", role: "headCounsellor" };

describe("buildCouplesFilter", () => {
  it("confines a counsellor to their own couples", () => {
    expect(buildCouplesFilter({}, counsellor)).toEqual({
      counsellorId: "u-counsellor",
    });
  });

  it("ignores a counsellor asking for someone else's couples", () => {
    // The portal sent counsellorId for them, but that was a client-side
    // courtesy — calling the endpoint directly returned everything.
    const filter = buildCouplesFilter({ counsellorId: "u-someone-else" }, counsellor);
    expect(filter.counsellorId).toBe("u-counsellor");
  });

  it("lets a head counsellor see everything by default", () => {
    expect(buildCouplesFilter({}, head)).toEqual({});
  });

  it("lets a head counsellor scope to one counsellor", () => {
    expect(buildCouplesFilter({ counsellorId: "u-x" }, head)).toEqual({
      counsellorId: "u-x",
    });
  });

  it("drops nested Prisma operators instead of passing them through", () => {
    // e.g. ?partners[some][phoneNumber][contains]=024 — an enumeration of
    // counsellees by phone number.
    const hostile = {
      partners: { some: { phoneNumber: { contains: "024" } } },
      OR: [{ id: { not: "" } }],
      counsellorId: { not: null },
    };
    const asHead = buildCouplesFilter(hostile, head);
    expect(asHead).toEqual({});
    expect(Object.keys(asHead)).not.toContain("partners");
    expect(Object.keys(asHead)).not.toContain("OR");

    const asCounsellor = buildCouplesFilter(hostile, counsellor);
    expect(asCounsellor).toEqual({ counsellorId: "u-counsellor" });
  });

  it("accepts only the whitelisted filters, correctly typed", () => {
    const filter = buildCouplesFilter(
      { completed: "true", counsellorAccepted: "", extra: "ignored" },
      head
    );
    expect(filter).toEqual({ completed: true, counsellorAccepted: "" });

    expect(buildCouplesFilter({ completed: "false" }, head).completed).toBe(false);
    // Anything that is not exactly "true"/"false" is not a filter at all.
    expect(buildCouplesFilter({ completed: "maybe" }, head).completed).toBeUndefined();
  });
});

describe("passwordRuleError — one rule for every path that sets a password", () => {
  it("accepts a password meeting every requirement", () => {
    expect(passwordRuleError("Str0ng!Pass")).toBeNull();
    expect(passwordRuleError("Val1d!Pass")).toBeNull();
  });

  it("rejects each missing requirement", () => {
    expect(passwordRuleError("Sh0rt!")).not.toBeNull(); // too short
    expect(passwordRuleError("nouppercase1!")).not.toBeNull();
    expect(passwordRuleError("NOLOWERCASE1!")).not.toBeNull();
    expect(passwordRuleError("NoDigitsHere!")).not.toBeNull();
    expect(passwordRuleError("NoSpecial123")).not.toBeNull();
  });

  it("rejects the passwords that used to slip through the reset path", () => {
    // This endpoint also consumes invite links, so it sets every counsellor's
    // first password — and accepted anything at all.
    expect(passwordRuleError("12345678")).not.toBeNull();
    expect(passwordRuleError("password")).not.toBeNull();
    expect(passwordRuleError("Demo12345")).not.toBeNull(); // no special character
  });

  it("rejects absent or non-string input", () => {
    expect(passwordRuleError("")).not.toBeNull();
    expect(passwordRuleError(undefined)).not.toBeNull();
    expect(passwordRuleError(null)).not.toBeNull();
    expect(passwordRuleError(12345678)).not.toBeNull();
  });
});
