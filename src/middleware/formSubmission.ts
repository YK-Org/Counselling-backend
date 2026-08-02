import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// The intake and questionnaire endpoints are filled in by counsellees, who have
// no account, so they cannot be behind a login. That leaves them writable by
// anyone who finds the URL — and a submission carries answers about sexual
// history, abuse and health.
//
// A Google Form cannot authenticate an individual respondent, but the Apps
// Script behind it can hold one shared secret. That does not stop somebody who
// has the form itself, which is public by design; it stops arbitrary writes
// from anyone who merely discovers the endpoint.
//
// Fails open when FORM_SHARED_SECRET is unset, so deploying this cannot take a
// live form offline. Set the value only after the Apps Script sends it.
const HEADER = "x-form-secret";

const timingSafeEqual = (a: string, b: string) => {
  const left = new Uint8Array(Buffer.from(a));
  const right = new Uint8Array(Buffer.from(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

export const requireFormSecret = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const expected = process.env.FORM_SHARED_SECRET;

  if (!expected) {
    console.warn(
      "FORM_SHARED_SECRET is not set — public form endpoints accept unauthenticated writes"
    );
    return next();
  }

  const provided = req.headers[HEADER];

  if (typeof provided !== "string" || !timingSafeEqual(provided, expected)) {
    // Deliberately vague: a precise message would help someone probing for the
    // right header name.
    return res.status(403).json({ message: "Forbidden" });
  }

  return next();
};
