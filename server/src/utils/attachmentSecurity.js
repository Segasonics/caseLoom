import crypto from "crypto";
import fs from "fs/promises";

// Default allowlist for healthcare-friendly upload formats.
const DEFAULT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
];

// EICAR test string is a safe marker used to test malware scanners.
const EICAR_SIGNATURE =
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeMimeType(value) {
  return String(value || "").trim().toLowerCase();
}

function parseMimeAllowlist() {
  // ATTACH_ALLOWED_MIME_TYPES can override defaults using comma-separated MIME values.
  const raw = String(process.env.ATTACH_ALLOWED_MIME_TYPES || "");
  if (!raw.trim()) return DEFAULT_ALLOWED_MIME_TYPES;
  return raw
    .split(",")
    .map((item) => normalizeMimeType(item))
    .filter(Boolean);
}

export const ATTACH_ALLOWED_MIME_TYPES = parseMimeAllowlist();
export const ATTACH_MAX_FILE_SIZE_BYTES =
  // Size is configured in MB but stored as bytes for multer limits.
  toPositiveInt(process.env.ATTACH_MAX_FILE_SIZE_MB, 10) * 1024 * 1024;

export const ATTACH_SIGNED_URL_TTL_SECONDS = toPositiveInt(
  process.env.ATTACH_SIGNED_URL_TTL_SECONDS,
  300
);

function getSigningSecret() {
  // Dedicated signing secret is preferred; JWT_SECRET fallback keeps setup simple.
  return process.env.ATTACHMENT_SIGNING_SECRET || process.env.JWT_SECRET || "";
}

export function attachmentFileFilter(req, file, cb) {
  const mimeType = normalizeMimeType(file?.mimetype);
  if (!ATTACH_ALLOWED_MIME_TYPES.includes(mimeType)) {
    return cb(
      new Error(
        `Unsupported file type. Allowed: ${ATTACH_ALLOWED_MIME_TYPES.join(", ")}`
      )
    );
  }
  return cb(null, true);
}

function createAttachmentSignature(payload) {
  const secret = getSigningSecret();
  if (!secret) {
    throw new Error("ATTACHMENT_SIGNING_SECRET or JWT_SECRET must be set");
  }
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function createSignedAttachmentToken(attachmentId, expiresAtMs) {
  const payload = `${attachmentId}.${expiresAtMs}`;
  return createAttachmentSignature(payload);
}

export function verifySignedAttachmentToken(attachmentId, expiresAtMs, signature) {
  const expected = createSignedAttachmentToken(attachmentId, expiresAtMs);
  // Use timing-safe compare to avoid leaking signature validity by timing.
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(String(signature || ""), "utf8");
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export function buildSignedAttachmentUrl(req, attachmentId) {
  const expiresAt = Date.now() + ATTACH_SIGNED_URL_TTL_SECONDS * 1000;
  const sig = createSignedAttachmentToken(attachmentId, expiresAt);
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  return {
    url: `${baseUrl}/api/files/attachments/${attachmentId}?expires=${expiresAt}&sig=${sig}`,
    expiresAt,
    ttlSeconds: ATTACH_SIGNED_URL_TTL_SECONDS,
  };
}

export async function scanFileForMalware(filePath, mimeType) {
  // Scan can be disabled for local dev if needed.
  const scanEnabled = String(process.env.MALWARE_SCAN_ENABLED || "true").toLowerCase() !== "false";
  if (!scanEnabled) {
    return { clean: true, skipped: true, reason: "Malware scan disabled by env" };
  }

  // Read a bounded prefix for quick signature checks.
  const buffer = await fs.readFile(filePath);
  const utf8 = buffer.toString("utf8");

  // Detect the standard EICAR string.
  if (utf8.includes(EICAR_SIGNATURE)) {
    return { clean: false, reason: "EICAR test signature detected" };
  }

  // Block executable files accidentally uploaded with misleading MIME.
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return { clean: false, reason: "Windows executable signature detected" };
  }

  // Basic PDF active-content check.
  if (normalizeMimeType(mimeType) === "application/pdf") {
    if (utf8.includes("/JavaScript") || utf8.includes("/JS")) {
      return { clean: false, reason: "PDF contains embedded JavaScript" };
    }
  }

  return { clean: true, skipped: false };
}
