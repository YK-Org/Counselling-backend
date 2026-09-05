import express from "express";
import cors from "cors";
import routes from "./routes";
import dotenv from "dotenv";
import MiddlewareService from "./middleware/index";
import { apiLimiter } from "./middleware/rateLimiter";

dotenv.config();
const app = express();

// Behind a managed host (Render, Fly, Railway, an nginx front) every request
// arrives from the proxy, so without this the rate limiters key all traffic to
// one IP and one noisy client locks out the whole deployment. The value is the
// number of proxies in front of this process — 1 for a typical single-hop PaaS.
// Left off entirely in local development, where there is no proxy to trust.
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy) {
  const hops = Number(trustProxy);
  app.set("trust proxy", Number.isFinite(hops) ? hops : trustProxy);
}

app.use(express.json());

// The API is a bearer-token API, so CORS is not what protects it — but leaving
// it open lets any page on the internet drive it with a token it has managed to
// read, and there is no reason for an origin other than the portal to call it.
// Comma-separated CORS_ORIGINS overrides, otherwise the portal's own APP_URL.
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.APP_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!allowedOrigins.length) {
  console.warn(
    "Neither CORS_ORIGINS nor APP_URL is set — all origins will be accepted"
  );
}

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header at all: curl, server-to-server, and the Apps Script
      // that posts intake forms. Those are not browser requests, so the
      // same-origin policy has nothing to say about them.
      if (!origin) return callback(null, true);
      if (!allowedOrigins.length) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Refuse by withholding the header rather than throwing. Throwing here
      // surfaces as a 500, which misreports a correctly blocked origin as a
      // server fault and fills the logs with false alarms. Without the header
      // the browser blocks the response itself, which is the actual mechanism.
      return callback(null, false);
    },
  })
);

// Ahead of checkAuthentication: a load balancer's probe has no token, and a
// health check that needs credentials is a health check that reports the
// service as down.
app.get("/health", (_request, response) =>
  response.status(200).json({ status: "ok" })
);

app.use("/api/v1", apiLimiter);
app.use(MiddlewareService.checkAuthentication);
app.use("/api/v1", routes);

// Last resort. Anything that reaches here escaped a route's own try/catch —
// without it Express replies with the default HTML error page, which includes
// a stack trace whenever NODE_ENV is not "production".
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", {
      message: err?.message,
      stack: err?.stack,
    });
    if (res.headersSent) return;
    res.status(500).json({ message: "An unexpected error occurred" });
  }
);

export default app;
