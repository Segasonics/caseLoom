import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDb } from "./config/db.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import casesRouter from "./routes/cases.js";
import decisionPointsRouter from "./routes/decisionPoints.js";
import appointmentsRouter from "./routes/appointments.js";
import authRouter from "./routes/auth.js";
import aiRouter from "./routes/ai.js";
import auditLogsRouter from "./routes/auditLogs.js";
import filesRouter from "./routes/files.js";
import { optionalAuth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";
import { writeRateLimiter } from "./middleware/security.js";

const app = express();

// Trust proxy headers so req.ip is correct behind reverse proxy/load balancer.
app.set("trust proxy", 1);

// CORS must allow credentials for secure refresh-token cookie flow.
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
  })
);
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
// Do not expose /uploads as a public static folder.
// Files are served only through signed URLs in /api/files.

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
});
app.use(optionalAuth);

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/cases", writeRateLimiter, casesRouter);
app.use("/api/decision-points", writeRateLimiter, decisionPointsRouter);
app.use("/api/appointments", writeRateLimiter, appointmentsRouter);
app.use("/api/auth", authRouter);
app.use("/api/ai", writeRateLimiter, aiRouter);
app.use("/api/audit-logs", auditLogsRouter);
app.use("/api/files", filesRouter);

app.use(errorHandler);

// Environment variables:
// - PORT: HTTP port for the API server (defaults to 4000)
// - MONGO_URL: MongoDB connection string (required)
// - JWT_SECRET: secret used to sign auth tokens (required)
// - OPENAI_API_KEY: OpenAI API key (required for AI endpoints)
// - OPENAI_MODEL: OpenAI model name (optional)
// - OPENAI_TEMPERATURE: OpenAI temperature (optional)
// - N8N_WEBHOOK_URL: n8n webhook for decision point events (optional)
// - TWILIO_ACCOUNT_SID: Twilio account SID (optional)
// - TWILIO_AUTH_TOKEN: Twilio auth token (optional)
// - TWILIO_FROM: Twilio phone number (optional)
// - AUTH_RATE_LIMIT_WINDOW_MS: auth limiter window in ms (optional)
// - AUTH_RATE_LIMIT_MAX: max auth requests per window per IP (optional)
// - AUTH_MAX_FAILED_ATTEMPTS: failed login attempts before lock (optional)
// - AUTH_LOCK_WINDOW_MS: lock duration in ms after too many failures (optional)
// - WRITE_RATE_LIMIT_WINDOW_MS: write limiter window in ms (optional)
// - WRITE_RATE_LIMIT_MAX: max write requests per window per IP (optional)
// - ATTACH_ALLOWED_MIME_TYPES: comma-separated MIME whitelist for attachments
// - ATTACH_MAX_FILE_SIZE_MB: max attachment size in MB
// - MALWARE_SCAN_ENABLED: true/false toggle for upload scanning
// - ATTACHMENT_SIGNING_SECRET: HMAC secret for signed attachment URLs
// - ATTACH_SIGNED_URL_TTL_SECONDS: signed attachment URL lifetime in seconds
// - CLIENT_ORIGIN: frontend origin for CORS credentialed requests
// - ACCESS_TOKEN_TTL: short-lived access token lifetime (default 15m)
// - REFRESH_TOKEN_DAYS: refresh cookie/session lifetime in days (default 30)
// - REFRESH_COOKIE_NAME: cookie name for refresh token (default caseloom_refresh_token)
const port = process.env.PORT || 4000;

connectDb(process.env.MONGO_URL)
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  });
