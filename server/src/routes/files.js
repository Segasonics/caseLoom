import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { Attachment } from "../models/Attachment.js";
import { verifySignedAttachmentToken } from "../utils/attachmentSecurity.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "../../uploads");

router.get("/attachments/:attachmentId", async (req, res) => {
  const { attachmentId } = req.params;
  const { expires, sig } = req.query;
  const expiresAt = Number(expires);

  // Signed URL requires expiry + signature for every file request.
  if (!expiresAt || !sig) {
    return res.status(400).json({ error: "Missing signed URL parameters" });
  }

  // Expired tokens are denied immediately.
  if (expiresAt < Date.now()) {
    return res.status(401).json({ error: "Signed URL expired" });
  }

  const valid = verifySignedAttachmentToken(attachmentId, expiresAt, sig);
  if (!valid) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const attachment = await Attachment.findById(attachmentId).lean();
  if (!attachment) {
    return res.status(404).json({ error: "Attachment not found" });
  }

  // Use basename to prevent path traversal and force lookup inside uploads folder.
  const safeFilename = path.basename(attachment.filename);
  const filePath = path.join(uploadsDir, safeFilename);

  try {
    await fs.access(filePath);
  } catch {
    return res.status(404).json({ error: "File missing on disk" });
  }

  // Mark response as private and short-lived to avoid browser/proxy reuse.
  res.setHeader("Cache-Control", "private, max-age=60");
  res.setHeader("Content-Type", attachment.mimeType || "application/octet-stream");

  // Keep original filename while forcing inline safe rendering.
  const safeName = String(attachment.originalName || "attachment")
    .replace(/[\r\n"]/g, "")
    .trim();
  res.setHeader("Content-Disposition", `inline; filename="${safeName || "attachment"}"`);

  return res.sendFile(filePath);
});

export default router;
