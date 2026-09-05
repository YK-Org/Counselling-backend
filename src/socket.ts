import * as jwt from "jsonwebtoken";
import { JwtPayload } from "jsonwebtoken";
import UsersService from "./services/users";

let io: any;

// Same list the HTTP API allows. `origin: "*"` let any page on the internet
// open an authenticated socket with a token it had got hold of.
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.APP_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export function initialize(server: any) {
  io = require("socket.io")(server, {
    cors: {
      origin: allowedOrigins.length ? allowedOrigins : "*",
    },
  });

  io.use(async function (socket: any, next: any) {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error"));

    try {
      const decoded = jwt.verify(
        token,
        process.env.TOKEN_SECRET as string
      ) as JwtPayload;

      // A valid signature is not enough. Signing out, changing a password and
      // being banned all work by moving `tokenIssuedAt`, and the HTTP
      // middleware checks it on every request — the socket did not, so a
      // revoked token kept a live connection and carried on receiving events.
      const user = await UsersService.getUser(decoded.user?.id);
      if (!user || decoded.iat !== user.tokenIssuedAt) {
        return next(new Error("Authentication error"));
      }

      socket.decoded = decoded;
      return next();
    } catch (err) {
      return next(new Error("Authentication error"));
    }
  }).on("connection", function (socket: any) {
    // Connection now authenticated to receive further events
    const body = socket.decoded;
    if (body.user && body.user.role === "headCounsellor") {
      socket.join(`headcounsellor`);
    } else {
      socket.join(`counsellor-${body.user.id}`);
    }
  });
}

export function getIO() {
  return io;
}

// Notifying the dashboard is a side effect, not part of saving a submission.
// `getIO().to(...)` threw if the server was still starting or socket.io had
// gone away, which turned a successfully stored intake form into a 500 — and
// the Apps Script treats that as a failed submission.
export function emitToHeadCounsellors(event: string) {
  try {
    io?.to("headcounsellor").emit(event);
  } catch (err: any) {
    console.error("Failed to emit socket event", { event, message: err?.message });
  }
}
