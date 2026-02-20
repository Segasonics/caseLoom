import express from "express";
import { AuditLog } from "../models/AuditLog.js";
import { requireAuth } from "../middleware/auth.js";
import { isAdmin } from "../middleware/rbac.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { entityType, entityId, actorEmail, limit = 100 } = req.query;
  const query = {};

  if (entityType) query.entityType = entityType;
  if (entityId) query.entityId = entityId;
  if (actorEmail) query.actorEmail = actorEmail;
  if (!isAdmin(req.user)) query.actorId = req.user.sub;

  const safeLimit = Math.min(Number(limit) || 100, 500);
  const logs = await AuditLog.find(query)
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();
  res.json(logs);
});

export default router;
