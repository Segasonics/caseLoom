import express from "express";
import { Case } from "../models/Case.js";
import { TimelineEvent } from "../models/TimelineEvent.js";
import { DecisionPoint } from "../models/DecisionPoint.js";
import { Appointment } from "../models/Appointment.js";
import { Task } from "../models/Task.js";
import { Attachment } from "../models/Attachment.js";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { logAudit } from "../utils/audit.js";
import { requireAuth } from "../middleware/auth.js";
import { buildCaseAccessQuery, findAccessibleCase, isCaseOwnerOrAdmin } from "../utils/access.js";
import { User } from "../models/User.js";
import {
  attachmentFileFilter,
  ATTACH_MAX_FILE_SIZE_BYTES,
  buildSignedAttachmentUrl,
  scanFileForMalware,
} from "../utils/attachmentSecurity.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "../../uploads");
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  }
});
const upload = multer({
  storage,
  // Hard file-size cap to prevent oversized uploads from exhausting memory/disk.
  limits: { fileSize: ATTACH_MAX_FILE_SIZE_BYTES },
  // MIME whitelist check runs before file is accepted.
  fileFilter: attachmentFileFilter,
});

function uploadSingleAttachment(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();

    // Multer provides specific error codes for upload failures.
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File too large for configured upload limit" });
      }
      return res.status(400).json({ error: err.message || "Attachment upload failed" });
    }

    return res.status(400).json({ error: err.message || "Invalid attachment" });
  });
}
router.use(requireAuth);

async function ensureCaseAccess(req, res, caseId, { requireOwner = false } = {}) {
  const caseItem = await findAccessibleCase(req.user, caseId, { lean: false });
  if (!caseItem) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  if (!caseItem.ownerId) {
    caseItem.ownerId = req.user.sub;
    await caseItem.save();
  }
  if (requireOwner && !isCaseOwnerOrAdmin(req.user, caseItem)) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return caseItem;
}

router.get("/", async (req, res) => {
  const items = await Case.find(buildCaseAccessQuery(req.user)).sort({ createdAt: -1 }).lean();
  res.json(items);
});

router.post("/", async (req, res) => {
  const { patientAlias, title, summary, tags } = req.body;
  const created = await Case.create({
    patientAlias,
    title,
    summary,
    tags: Array.isArray(tags) ? tags : [],
    ownerId: req.user.sub
  });
  await logAudit({
    req,
    action: "case.create",
    entityType: "case",
    entityId: created._id,
    after: created.toObject(),
  });
  res.status(201).json(created);
});

router.get("/:id", async (req, res) => {
  const item = await findAccessibleCase(req.user, req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });
  if (!item.ownerId) {
    await Case.findByIdAndUpdate(item._id, { ownerId: req.user.sub });
    item.ownerId = req.user.sub;
  }

  const timeline = await TimelineEvent.find({ caseId: item._id }).sort({
    occurredAt: -1,
  }).lean();
  const decisions = await DecisionPoint.find({ caseId: item._id }).sort({
    createdAt: -1,
  }).lean();
  const tasks = await Task.find({ caseId: item._id }).sort({
    createdAt: -1,
  }).lean();
  const appointments = await Appointment.find({ caseId: item._id }).sort({
    scheduledFor: 1,
  }).lean();
  const attachments = await Attachment.find({ caseId: item._id }).sort({
    createdAt: -1,
  }).lean();
  res.json({ case: item, timeline, decisions, tasks, appointments, attachments });
});

router.patch("/:id", async (req, res) => {
  const { status, tags } = req.body;
  if (typeof status === "undefined" && typeof tags === "undefined") {
    return res.status(400).json({ error: "No fields to update" });
  }
  if (typeof status !== "undefined" && !["open", "closed"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  const before = await findAccessibleCase(req.user, req.params.id);
  if (!before) return res.status(404).json({ error: "Not found" });

  const update = {};
  if (!before.ownerId) update.ownerId = req.user.sub;
  if (typeof status !== "undefined") update.status = status;
  if (typeof tags !== "undefined") update.tags = Array.isArray(tags) ? tags : [];

  const updated = await Case.findOneAndUpdate(
    { _id: req.params.id, ...buildCaseAccessQuery(req.user) },
    update,
    { new: true }
  );
  await logAudit({
    req,
    action: "case.update",
    entityType: "case",
    entityId: req.params.id,
    before,
    after: updated?.toObject?.() || updated,
  });
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const caseItem = await ensureCaseAccess(req, res, req.params.id, { requireOwner: true });
  if (!caseItem) return;
  const deleted = await Case.findByIdAndDelete(caseItem._id);
  const attachmentsToDelete = await Attachment.find({ caseId: caseItem._id }).lean();
  await TimelineEvent.deleteMany({ caseId: caseItem._id });
  await DecisionPoint.deleteMany({ caseId: caseItem._id });
  await Task.deleteMany({ caseId: caseItem._id });
  await Attachment.deleteMany({ caseId: caseItem._id });
  await Appointment.deleteMany({ caseId: caseItem._id });
  // Best-effort cleanup of uploaded files belonging to this case.
  await Promise.all(
    attachmentsToDelete.map((item) =>
      fs.unlink(path.join(uploadDir, path.basename(item.filename))).catch(() => {})
    )
  );
  await logAudit({
    req,
    action: "case.delete",
    entityType: "case",
    entityId: req.params.id,
    before: deleted.toObject(),
  });
  res.json({ ok: true });
});

router.post("/:id/timeline", async (req, res) => {
  const caseItem = await ensureCaseAccess(req, res, req.params.id);
  if (!caseItem) return;
  const { kind, description, occurredAt } = req.body;
  const created = await TimelineEvent.create({
    caseId: caseItem._id,
    kind,
    description,
    occurredAt,
  });
  await logAudit({
    req,
    action: "timeline.create",
    entityType: "timeline_event",
    entityId: created._id,
    after: created.toObject(),
    meta: { caseId: req.params.id },
  });
  res.status(201).json(created);
});

router.post("/:id/decision-points", async (req, res) => {
  const caseItem = await ensureCaseAccess(req, res, req.params.id);
  if (!caseItem) return;
  const { decisionType, rationale, nextStep, followUpBy } = req.body;
  const created = await DecisionPoint.create({
    caseId: caseItem._id,
    decisionType,
    rationale,
    nextStep,
    followUpBy,
  });
  await logAudit({
    req,
    action: "decision.create",
    entityType: "decision_point",
    entityId: created._id,
    after: created.toObject(),
    meta: { caseId: req.params.id },
  });

  // Environment variable:
  // - N8N_WEBHOOK_URL: full webhook URL for the n8n workflow (optional)
  if (process.env.N8N_WEBHOOK_URL) {
    try {
      await fetch(process.env.N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: created.caseId,
          patientAlias: caseItem?.patientAlias || null,
          caseTitle: caseItem?.title || null,
          decisionPointId: created._id,
          decisionType: created.decisionType,
          rationale: created.rationale,
          nextStep: created.nextStep,
          followUpBy: created.followUpBy,
          createdAt: created.createdAt,
        }),
      });
    } catch (err) {
      console.error("Failed to send n8n webhook", err);
    }
  }

  res.status(201).json(created);
});

router.post("/:id/tasks", async (req, res) => {
  const caseItem = await ensureCaseAccess(req, res, req.params.id);
  if (!caseItem) return;
  const { title, dueAt } = req.body;
  if (!title) return res.status(400).json({ error: "Title is required" });
  const created = await Task.create({
    caseId: caseItem._id,
    title,
    dueAt: dueAt || null,
  });
  await logAudit({
    req,
    action: "task.create",
    entityType: "task",
    entityId: created._id,
    after: created.toObject(),
    meta: { caseId: req.params.id },
  });
  res.status(201).json(created);
});

router.patch("/:id/tasks/:taskId", async (req, res) => {
  const caseItem = await ensureCaseAccess(req, res, req.params.id);
  if (!caseItem) return;
  const { status } = req.body;
  if (!["open", "done"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  const before = await Task.findOne({ _id: req.params.taskId, caseId: caseItem._id }).lean();
  if (!before) return res.status(404).json({ error: "Not found" });
  const updated = await Task.findOneAndUpdate(
    { _id: req.params.taskId, caseId: caseItem._id },
    { status },
    { new: true }
  );
  await logAudit({
    req,
    action: "task.update",
    entityType: "task",
    entityId: req.params.taskId,
    before,
    after: updated.toObject(),
    meta: { caseId: req.params.id },
  });
  res.json(updated);
});

router.delete("/:id/tasks/:taskId", async (req, res) => {
  const caseItem = await ensureCaseAccess(req, res, req.params.id);
  if (!caseItem) return;
  const deleted = await Task.findOneAndDelete({
    _id: req.params.taskId,
    caseId: caseItem._id,
  });
  if (!deleted) return res.status(404).json({ error: "Not found" });
  await logAudit({
    req,
    action: "task.delete",
    entityType: "task",
    entityId: req.params.taskId,
    before: deleted.toObject(),
    meta: { caseId: req.params.id },
  });
  res.json({ ok: true });
});

router.post("/:id/attachments", uploadSingleAttachment, async (req, res) => {
  const caseItem = await ensureCaseAccess(req, res, req.params.id);
  if (!caseItem) return;
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  // Run a lightweight malware screening step before persisting metadata.
  const scan = await scanFileForMalware(req.file.path, req.file.mimetype);
  if (!scan.clean) {
    // Delete rejected file immediately so unsafe content is not stored.
    await fs.unlink(req.file.path).catch(() => {});
    return res.status(400).json({ error: `Attachment blocked: ${scan.reason}` });
  }

  const created = await Attachment.create({
    caseId: caseItem._id,
    originalName: req.file.originalname,
    filename: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size
  });
  await logAudit({
    req,
    action: "attachment.create",
    entityType: "attachment",
    entityId: created._id,
    after: created.toObject(),
    meta: { caseId: req.params.id },
  });

  // Return a short-lived signed download URL to avoid exposing raw file paths.
  const signed = buildSignedAttachmentUrl(req, created._id.toString());
  res.status(201).json({
    ...created.toObject(),
    signedUrl: signed.url,
    signedUrlExpiresAt: signed.expiresAt,
  });
});

router.get("/:id/attachments/:attachmentId/url", async (req, res) => {
  const caseItem = await ensureCaseAccess(req, res, req.params.id);
  if (!caseItem) return;

  const attachment = await Attachment.findOne({
    _id: req.params.attachmentId,
    caseId: caseItem._id,
  }).lean();

  if (!attachment) return res.status(404).json({ error: "Attachment not found" });

  const signed = buildSignedAttachmentUrl(req, attachment._id.toString());
  res.json({
    url: signed.url,
    expiresAt: signed.expiresAt,
    ttlSeconds: signed.ttlSeconds,
  });
});

router.delete("/:id/attachments/:attachmentId", async (req, res) => {
  const caseItem = await ensureCaseAccess(req, res, req.params.id);
  if (!caseItem) return;
  const deleted = await Attachment.findOneAndDelete({
    _id: req.params.attachmentId,
    caseId: caseItem._id
  });
  if (!deleted) return res.status(404).json({ error: "Not found" });
  // Remove file from disk when metadata is deleted.
  await fs.unlink(path.join(uploadDir, path.basename(deleted.filename))).catch(() => {});
  await logAudit({
    req,
    action: "attachment.delete",
    entityType: "attachment",
    entityId: req.params.attachmentId,
    before: deleted.toObject(),
    meta: { caseId: req.params.id },
  });
  res.json({ ok: true });
});

router.post("/:id/share", async (req, res) => {
  const caseItem = await ensureCaseAccess(req, res, req.params.id, { requireOwner: true });
  if (!caseItem) return;

  const email = String(req.body?.email || "").toLowerCase().trim();
  if (!email) return res.status(400).json({ error: "email is required" });

  const targetUser = await User.findOne({ email }).lean();
  if (!targetUser) return res.status(404).json({ error: "User not found" });
  if (targetUser._id.toString() === caseItem.ownerId.toString()) {
    return res.status(400).json({ error: "Owner already has access" });
  }

  await Case.findByIdAndUpdate(caseItem._id, {
    $addToSet: { sharedWith: targetUser._id }
  });

  await logAudit({
    req,
    action: "case.share.add",
    entityType: "case",
    entityId: caseItem._id,
    meta: { sharedUserId: targetUser._id.toString(), sharedUserEmail: targetUser.email }
  });

  const updated = await Case.findById(caseItem._id).lean();
  res.json(updated);
});

router.get("/:id/share", async (req, res) => {
  const caseItem = await ensureCaseAccess(req, res, req.params.id);
  if (!caseItem) return;

  const owner = caseItem.ownerId
    ? await User.findById(caseItem.ownerId).select("_id name email role").lean()
    : null;
  const sharedUsers = caseItem.sharedWith?.length
    ? await User.find({ _id: { $in: caseItem.sharedWith } })
      .select("_id name email role")
      .sort({ name: 1 })
      .lean()
    : [];

  res.json({
    owner,
    sharedUsers,
  });
});

router.delete("/:id/share/:userId", async (req, res) => {
  const caseItem = await ensureCaseAccess(req, res, req.params.id, { requireOwner: true });
  if (!caseItem) return;

  await Case.findByIdAndUpdate(caseItem._id, {
    $pull: { sharedWith: req.params.userId }
  });

  await logAudit({
    req,
    action: "case.share.remove",
    entityType: "case",
    entityId: caseItem._id,
    meta: { sharedUserId: req.params.userId }
  });

  const updated = await Case.findById(caseItem._id).lean();
  res.json(updated);
});

export default router;
