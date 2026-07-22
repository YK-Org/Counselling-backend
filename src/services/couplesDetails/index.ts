import prisma from "../../prisma/client";
import { ICouplesDetails } from "../../types/models/CouplesDetails";
import { parsePhoneNumber } from "awesome-phonenumber";

// Scalar columns on the Partner table (vs. the jsonb history groups below).
const COLUMN_KEYS = [
  "name",
  "phoneNumber",
  "dateOfBirth",
  "gender",
  "hometown",
  "churchAfterMarriage",
  "orderOfBirth",
];

// Nested personal-history groups stored as jsonb columns.
const JSON_KEYS = [
  "education",
  "profession",
  "parents",
  "partner",
  "religion",
  "siblings",
  "otherInfo",
];

const isPlainObject = (v: any) =>
  v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);

// transformFormData produces flat dot-notation keys (e.g. "education.level").
// Expand them into a nested object.
const setDeep = (obj: any, path: string, value: any) => {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!isPlainObject(cur[parts[i]])) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
};

const expandDotKeys = (flat: any) => {
  const out: any = {};
  for (const key in flat) setDeep(out, key, flat[key]);
  return out;
};

const deepMerge = (target: any, source: any): any => {
  const out: any = isPlainObject(target) ? { ...target } : {};
  for (const key in source) {
    if (isPlainObject(source[key]) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key], source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
};

const toE164 = (phoneNumber?: string) =>
  (phoneNumber && parsePhoneNumber(phoneNumber).number?.e164) || phoneNumber;

class CouplesDetailsService {
  async createDetails(data: Partial<ICouplesDetails>) {
    try {
      const response = await prisma.partner.create({
        data: {
          name: data.name as string,
          phoneNumber: toE164(data.phoneNumber),
          ...(data.gender ? { gender: data.gender as any } : {}),
        },
      });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async updateDetails(phoneNumber: string, data: any) {
    try {
      const nested = expandDotKeys(data);
      const e164 = toE164(phoneNumber) as string;

      // Split into scalar columns and jsonb groups.
      const columns: any = {};
      for (const key of COLUMN_KEYS) {
        if (key in nested) columns[key] = nested[key];
      }
      columns.phoneNumber = e164;
      if (typeof columns.dateOfBirth === "string") {
        const d = new Date(columns.dateOfBirth);
        if (isNaN(d.getTime())) delete columns.dateOfBirth;
        else columns.dateOfBirth = d;
      }

      const existing = await prisma.partner.findFirst({
        where: { phoneNumber: e164 },
      });

      // Deep-merge jsonb groups with any existing data (replicates Mongo's
      // dot-notation partial update semantics).
      const jsonData: any = {};
      for (const key of JSON_KEYS) {
        if (key in nested) {
          const prev = existing ? (existing as any)[key] : undefined;
          jsonData[key] = isPlainObject(prev)
            ? deepMerge(prev, nested[key])
            : nested[key];
        }
      }

      const writeData = { ...columns, ...jsonData };

      if (existing) {
        return await prisma.partner.update({
          where: { id: existing.id },
          data: writeData,
        });
      }

      return await prisma.partner.create({ data: writeData });
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async findPartner(phoneNumber: string, expand?: string[]) {
    try {
      const e164 = toE164(phoneNumber) || "";
      const response = await prisma.partner.findFirst({
        where: { phoneNumber: e164 },
        ...(expand?.includes("couple") ? { include: { couple: true } } : {}),
      });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async assignCounsellor(coupleId: string, counsellorId: string) {
    try {
      const response = await prisma.couple.update({
        where: { id: coupleId },
        data: { counsellorId, counsellorAccepted: "" },
      });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async acceptDeclineCouple(coupleId: string, acceptDecline: string) {
    try {
      let data: any = {};
      if (acceptDecline === "accept") {
        data = { counsellorAccepted: acceptDecline };
      } else if (acceptDecline === "decline") {
        data = { counsellorAccepted: "", counsellorId: null };
      }
      const response = await prisma.couple.update({
        where: { id: coupleId },
        data,
      });
      return response;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
}

export default new CouplesDetailsService();
