import express from "express";
import { Appointment } from "../models/Appointment.js";
import { logAudit } from "../utils/audit.js";
import { requireAuth } from "../middleware/auth.js";
import { Case } from "../models/Case.js";
import { buildCaseAccessQuery, findAccessibleCase } from "../utils/access.js";
import { isAdmin } from "../middleware/rbac.js";

const router = express.Router();
router.use(requireAuth);

async function sendTwilioSms(to, body) {
  if (!to) {
    console.log("SMS skipped: missing contact phone.");
    return;
  }
  const digits = to.replace(/[^\d]/g, "");
  const normalizedTo = digits ? `+${digits}` : "";
  if (!/^\+\d{6,15}$/.test(normalizedTo)) {
    console.log("SMS skipped: invalid phone format.", to);
    return;
  }
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
    console.log("SMS skipped: Twilio credentials missing.");
    return;
  }

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const form = new URLSearchParams({
    To: normalizedTo,
    From: TWILIO_FROM,
    Body: body
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Twilio SMS failed", response.status, errorText);
  } else {
    await response.text();
  }
}

async function buildAppointmentQuery(user, query = {}) {
  if (isAdmin(user)) return query;

  const accessibleCaseIds = await Case.find(buildCaseAccessQuery(user)).distinct("_id");
  return {
    ...query,
    $or: [
      { caseId: { $in: accessibleCaseIds } },
      { caseId: { $exists: false }, createdBy: user.sub },
      { caseId: null, createdBy: user.sub }
    ]
  };
}

async function canAccessAppointment(user, appointment) {
  if (isAdmin(user)) return true;
  if (appointment.caseId) {
    const caseItem = await findAccessibleCase(user, appointment.caseId, { lean: true });
    return Boolean(caseItem);
  }
  return appointment.createdBy?.toString() === user.sub;
}

router.get("/", async (req, res) => {
  const { from, to } = req.query;
  let query = {};

  if (from || to) {
    query = { ...query, scheduledFor: {} };
    if (from) query.scheduledFor.$gte = new Date(from);
    if (to) query.scheduledFor.$lte = new Date(to);
  }

  query = await buildAppointmentQuery(req.user, query);
  const items = await Appointment.find(query).sort({ scheduledFor: 1 }).limit(200).lean();
  res.json(items);
});

router.post("/", async (req, res) => {
  const { caseId, patientAlias, contactPhone, title, scheduledFor, status, notes } = req.body;
  if (caseId) {
    const caseItem = await findAccessibleCase(req.user, caseId, { lean: true });
    if (!caseItem) return res.status(403).json({ error: "Forbidden" });
  }
  const created = await Appointment.create({
    createdBy: req.user.sub,
    caseId: caseId || undefined,
    patientAlias,
    contactPhone,
    title,
    scheduledFor,
    status,
    notes,
    statusHistory: [
      { state: "scheduled", reason: "Booked", at: new Date() }
    ]
  });
  await logAudit({
    req,
    action: "appointment.create",
    entityType: "appointment",
    entityId: created._id,
    after: created.toObject(),
  });

  try {
    const body = `Your appointment is booked for ${new Date(created.scheduledFor).toLocaleString()}. If you need to reschedule, please contact the clinic.`;
    await sendTwilioSms(contactPhone, body);
  } catch (err) {
    console.error("Twilio SMS send error", err);
  }

  res.status(201).json(created);
});

router.patch("/:id", async (req, res) => {
  const {
    caseId,
    patientAlias,
    contactPhone,
    title,
    scheduledFor,
    status,
    notes,
    statusReason,
    rescheduleReason
  } = req.body;
  const existing = await Appointment.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  const allowed = await canAccessAppointment(req.user, existing);
  if (!allowed) return res.status(403).json({ error: "Forbidden" });

  if (typeof caseId !== "undefined" && caseId) {
    const targetCase = await findAccessibleCase(req.user, caseId, { lean: true });
    if (!targetCase) return res.status(403).json({ error: "Forbidden" });
  }
  const before = existing.toObject();

  const nextCaseId =
    typeof caseId === "undefined"
      ? existing.caseId
      : caseId
        ? caseId
        : undefined;

  const updated = await Appointment.findByIdAndUpdate(
    req.params.id,
    {
      caseId: nextCaseId,
      patientAlias:
        typeof patientAlias === "undefined" ? existing.patientAlias : patientAlias,
      contactPhone:
        typeof contactPhone === "undefined" ? existing.contactPhone : contactPhone,
      title: typeof title === "undefined" ? existing.title : title,
      scheduledFor:
        typeof scheduledFor === "undefined" ? existing.scheduledFor : scheduledFor,
      status: typeof status === "undefined" ? existing.status : status,
      notes: typeof notes === "undefined" ? existing.notes : notes
    },
    { new: true }
  );

  const hasRescheduled =
    typeof scheduledFor !== "undefined" &&
    new Date(scheduledFor).getTime() !== new Date(existing.scheduledFor).getTime();

  const hasStatusChange =
    typeof status !== "undefined" && status !== existing.status;

  if (hasRescheduled) {
    await Appointment.findByIdAndUpdate(req.params.id, {
      $push: {
        statusHistory: {
          state: "rescheduled",
          reason: rescheduleReason || "",
          at: new Date()
        }
      }
    });
  }

  if (hasStatusChange) {
    await Appointment.findByIdAndUpdate(req.params.id, {
      $push: {
        statusHistory: {
          state: status,
          reason: statusReason || "",
          at: new Date()
        }
      }
    });
  }

  await logAudit({
    req,
    action: "appointment.update",
    entityType: "appointment",
    entityId: req.params.id,
    before,
    after: updated.toObject(),
    meta: {
      hasRescheduled,
      hasStatusChange,
      statusReason: statusReason || "",
      rescheduleReason: rescheduleReason || "",
    },
  });

  try {
    if (hasRescheduled) {
      const reasonText = (rescheduleReason || "").trim() || "Not specified";
      const body = `Your appointment has been rescheduled to ${new Date(updated.scheduledFor).toLocaleString()}. Reason: ${reasonText}. If you need help, please contact the clinic.`;
      await sendTwilioSms(updated.contactPhone, body);
    }

    if (hasStatusChange && status === "cancelled") {
      const reasonText = (statusReason || "").trim() || "Not specified";
      const body = `Your appointment scheduled for ${new Date(updated.scheduledFor).toLocaleString()} has been cancelled. Reason: ${reasonText}. Please contact the clinic to rebook.`;
      await sendTwilioSms(updated.contactPhone, body);
    }
  } catch (err) {
    console.error("Twilio SMS update send error", err);
  }

  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const existing = await Appointment.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  const allowed = await canAccessAppointment(req.user, existing);
  if (!allowed) return res.status(403).json({ error: "Forbidden" });
  const deleted = await Appointment.findByIdAndDelete(req.params.id);
  await logAudit({
    req,
    action: "appointment.delete",
    entityType: "appointment",
    entityId: req.params.id,
    before: deleted.toObject(),
  });
  res.json({ ok: true });
});

export default router;
