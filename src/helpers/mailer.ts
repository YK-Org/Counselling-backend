import nodemailer from "nodemailer";

// This used to catch every error and log it as `console.log("bb", error)`, so a
// failed send was indistinguishable from a successful one: callers awaited it,
// got undefined either way, and reported success. Failures now propagate, and
// each caller decides what that means for its own response — the work they did
// before sending (creating an account, assigning a counsellor) is already
// committed, so a mail failure is rarely a reason to fail the whole request.
export const sendMail = async (mailOptions: any) => {
  const user = process.env.EMAIL;
  const pass = process.env.GOOGLE_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      "Mail is not configured: EMAIL and GOOGLE_APP_PASSWORD must be set"
    );
  }

  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
    // Without these a network stall hangs the request until the socket dies.
    connectionTimeout: 20000,
    greetingTimeout: 20000,
  });

  return transport.sendMail(mailOptions);
};
