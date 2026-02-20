import { AuditLog } from "../models/AuditLog.js";

export async function logAudit({
  req,
  action,
  entityType,
  entityId,
  before = null,
  after = null,
  meta = null,
}) {
  try {
    await AuditLog.create({
      actorId: req?.user?.sub || "",
      actorEmail: req?.user?.email || "",
      action,
      entityType,
      entityId: entityId ? entityId.toString() : "",
      before,
      after,
      meta,
      ip: req?.ip || "",
      userAgent: req?.headers?.["user-agent"] || "",
    });
  } catch (err) {
    console.error("Audit log failed", err);
  }
}
