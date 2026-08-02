import { parsePhoneNumber } from "awesome-phonenumber";

// The intake form asks for an international number, but plenty of people type a
// local one anyway. Without a region hint "0244123456" and "+233244123456" are
// two different people to the system, and a couple silently never links.
const DEFAULT_REGION = (process.env.DEFAULT_PHONE_REGION || "GH") as any;

export const toE164 = (phoneNumber?: string | null) => {
  if (!phoneNumber) return phoneNumber || undefined;
  const trimmed = String(phoneNumber).trim();
  return (
    parsePhoneNumber(trimmed).number?.e164 ||
    parsePhoneNumber(trimmed, { regionCode: DEFAULT_REGION }).number?.e164 ||
    trimmed
  );
};
