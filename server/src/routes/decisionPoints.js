import express from "express";
import { DecisionPoint } from "../models/DecisionPoint.js";
import { requireAuth } from "../middleware/auth.js";
import { Case } from "../models/Case.js";
import { buildCaseAccessQuery } from "../utils/access.js";
import { isAdmin } from "../middleware/rbac.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  let query = {};
  if (!isAdmin(req.user)) {
    const caseIds = await Case.find(buildCaseAccessQuery(req.user)).distinct("_id");
    query = { caseId: { $in: caseIds } };
  }
  const items = await DecisionPoint.find(query).sort({ createdAt: -1 }).limit(100);
  res.json(items);
});

export default router;
