import {
  generateReferenceCode,
  normaliseReferenceCode,
} from "../../src/helpers/referenceCode";
import { toE164 } from "../../src/helpers/phoneNumber";
import { normaliseGender } from "../../src/helpers/gender";
import { resolveSlot } from "../../src/routes/couples";

// These functions decide which person a form submission belongs to. Getting it
// wrong attaches one partner's answers about sex, abuse and health to the
// other, which is why the behaviour is pinned here rather than left to be
// re-derived by whoever next edits it.

describe("normaliseReferenceCode", () => {
  it("accepts what a respondent actually types", () => {
    // Lower case, missing hyphen, stray spaces — all the same code.
    expect(normaliseReferenceCode("ACD-234")).toBe("ACD-234");
    expect(normaliseReferenceCode("acd234")).toBe("ACD-234");
    expect(normaliseReferenceCode("  acd-234  ")).toBe("ACD-234");
    expect(normaliseReferenceCode("a c d 2 3 4")).toBe("ACD-234");
    expect(normaliseReferenceCode("ACD--234")).toBe("ACD-234");
  });

  it("corrects B to 8, the one substitution that cannot be ambiguous", () => {
    // B is deliberately absent from the alphabet, so a "B" can only ever be a
    // misread 8 and is safe to fix.
    expect(normaliseReferenceCode("ACDB34")).toBe("ACD-834");
  });

  it("rejects rather than guesses when a character is ambiguous", () => {
    // O/0, I/L/1 and S/5 are all excluded from the alphabet, both halves of
    // each pair. A misread must fail and go to the queue, never resolve to a
    // different real couple.
    for (const bad of ["ACD-0O0", "ACD-1I1", "ACD-5S5", "ACD-111"]) {
      expect(normaliseReferenceCode(bad)).toBeNull();
    }
  });

  it("rejects wrong lengths and empty input", () => {
    expect(normaliseReferenceCode("ACD-23")).toBeNull();
    expect(normaliseReferenceCode("ACD-2345")).toBeNull();
    expect(normaliseReferenceCode("")).toBeNull();
    expect(normaliseReferenceCode(null)).toBeNull();
    expect(normaliseReferenceCode(undefined)).toBeNull();
  });

  it("round-trips every generated code", () => {
    // A code the app hands out must always be one the app accepts back.
    for (let i = 0; i < 200; i++) {
      const code = generateReferenceCode();
      expect(normaliseReferenceCode(code)).toBe(code);
      expect(normaliseReferenceCode(code.toLowerCase().replace("-", ""))).toBe(code);
    }
  });
});

describe("toE164", () => {
  it("treats a local and an international number as the same person", () => {
    // The whole reason this exists: without a region hint these are two
    // different people and a couple silently never links.
    expect(toE164("0244000111")).toBe(toE164("+233244000111"));
    expect(toE164("+233244000111")).toBe("+233244000111");
  });

  it("tolerates spacing and punctuation", () => {
    expect(toE164(" 024 400 0111 ")).toBe("+233244000111");
    expect(toE164("024-400-0111")).toBe("+233244000111");
  });

  it("returns the input unchanged when it cannot be parsed", () => {
    // Better to keep what was typed than to discard it — it still shows up in
    // the unmatched queue for a person to read.
    expect(toE164("not a number")).toBe("not a number");
  });

  it("passes through empty values", () => {
    expect(toE164("")).toBeUndefined();
    expect(toE164(null)).toBeUndefined();
    expect(toE164(undefined)).toBeUndefined();
  });
});

describe("normaliseGender", () => {
  it("accepts the wordings a form might use", () => {
    for (const male of ["Male", "male", "M", "man", "Husband", "GROOM"]) {
      expect(normaliseGender(male)).toBe("male");
    }
    for (const female of ["Female", "female", "F", "woman", "Wife", "Bride"]) {
      expect(normaliseGender(female)).toBe("female");
    }
  });

  it("returns undefined rather than guessing at anything else", () => {
    // A guess here writes the wrong gender onto a partner's record.
    expect(normaliseGender("other")).toBeUndefined();
    expect(normaliseGender("")).toBeUndefined();
    expect(normaliseGender(null)).toBeUndefined();
  });
});

describe("resolveSlot — which partner an intake form belongs to", () => {
  const couple = (partners: any[]) => ({ partners });
  const man = {
    id: "m",
    gender: "male",
    phoneNumber: "+233244000111",
    formSubmittedAt: null,
  };
  const woman = {
    id: "f",
    gender: "female",
    phoneNumber: "+233244000222",
    formSubmittedAt: null,
  };

  it("matches on phone first, even for a slot already filled in", () => {
    // A number already on the couple means the same person submitting again —
    // a correction or a second attempt — so they may update their own record.
    const filled = { ...man, formSubmittedAt: new Date() };
    const result = resolveSlot(couple([filled, woman]), "+233244000111", "female");
    expect(result.id).toBe("m");
  });

  it("falls back to gender among slots still awaiting a form", () => {
    const result = resolveSlot(couple([man, woman]), undefined, "female");
    expect(result.id).toBe("f");
  });

  it("will not overwrite a filled slot on gender alone", () => {
    // Otherwise anyone holding the code could overwrite a partner's answers
    // by picking their gender on the form.
    const filledWoman = { ...woman, formSubmittedAt: new Date() };
    const result = resolveSlot(couple([man, filledWoman]), undefined, "female");
    expect(result.id).toBe("m");
  });

  it("returns null when both partners have already submitted", () => {
    const both = [
      { ...man, formSubmittedAt: new Date() },
      { ...woman, formSubmittedAt: new Date() },
    ];
    expect(resolveSlot(couple(both), "+233299999999", "female")).toBeNull();
  });

  it("uses the remaining outstanding slot when gender is not given", () => {
    const filledMan = { ...man, formSubmittedAt: new Date() };
    const result = resolveSlot(couple([filledMan, woman]), undefined, undefined);
    expect(result.id).toBe("f");
  });
});
