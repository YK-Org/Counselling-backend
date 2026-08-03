// Builds the intake form link for a couple, with their reference code already
// filled in.
//
// Google Forms supports prefilling a field through the URL, which is far more
// reliable than asking two people to transcribe a code by hand. The template
// has to be configured rather than hardcoded: the entry id belongs to a
// specific question in a specific form, and only exists once that question has
// been created.
//
// Get it from the form: ⋮ → "Get pre-filled link" → put anything in Reference
// Code → "Get link" → copy, then replace the value you typed with {{code}}.
//
// INTAKE_FORM_PREFILL_URL=https://docs.google.com/forms/d/e/FORM_ID/viewform?usp=pp_url&entry.123456789={{code}}
const PLACEHOLDER = "{{code}}";

export function buildIntakeFormLink(referenceCode?: string | null) {
  const template = process.env.INTAKE_FORM_PREFILL_URL;
  if (!template || !referenceCode) return null;

  // Without the placeholder every couple would get the same link, quietly
  // sending both partners to a form prefilled with somebody else's code.
  if (!template.includes(PLACEHOLDER)) {
    console.warn(
      `INTAKE_FORM_PREFILL_URL does not contain ${PLACEHOLDER} — no prefilled links will be produced`
    );
    return null;
  }

  return template.replace(PLACEHOLDER, encodeURIComponent(referenceCode));
}
