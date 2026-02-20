import { Case } from "../models/Case.js";
import { isAdmin } from "../middleware/rbac.js";

export function buildCaseAccessQuery(user) {
  if (isAdmin(user)) return {};
  if (!user?.sub) return { _id: null };
  return {
    $or: [{ ownerId: user.sub }, { sharedWith: user.sub }, { ownerId: { $exists: false } }],
  };
}

export function isCaseOwnerOrAdmin(user, caseItem) {
  if (isAdmin(user)) return true;
  return caseItem?.ownerId?.toString() === user?.sub;
}

export async function findAccessibleCase(user, caseId, { lean = true } = {}) {
  let query = Case.findOne({ _id: caseId, ...buildCaseAccessQuery(user) });
  if (lean) query = query.lean();
  return query;
}
