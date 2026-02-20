import express from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import {
  authRateLimiter,
  checkLoginLock,
  recordLoginFailure,
  clearLoginFailures,
} from "../middleware/security.js";
import {
  attachRefreshCookie,
  buildAuthResponse,
  clearRefreshCookie,
  createSessionForUser,
  revokeRefreshSessionFromRequest,
  rotateRefreshSession,
} from "../utils/sessionAuth.js";

const router = express.Router();

// Limit auth traffic to reduce credential stuffing bursts.
router.use(authRateLimiter);

router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ error: "Email already in use" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email: email.toLowerCase(), passwordHash });
  const { refreshTokenValue } = await createSessionForUser({ user, req });
  attachRefreshCookie(res, refreshTokenValue);
  // Return short-lived access token + user payload for app state.
  res.status(201).json(buildAuthResponse(user));
});

router.post("/login", checkLoginLock, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password" });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    // Record failed logins so repeated invalid attempts trigger lockout.
    recordLoginFailure(req);
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    // Wrong password also increments brute-force counter.
    recordLoginFailure(req);
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Successful auth clears previous failed-attempt state for this key.
  clearLoginFailures(req);
  const { refreshTokenValue } = await createSessionForUser({ user, req });
  attachRefreshCookie(res, refreshTokenValue);
  // Access token is intentionally short-lived; refresh cookie handles long session.
  res.json(buildAuthResponse(user));
});

router.post("/refresh", async (req, res) => {
  const rotated = await rotateRefreshSession({ req });
  if (rotated.error) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: "Unauthorized" });
  }

  attachRefreshCookie(res, rotated.refreshTokenValue);
  return res.json(buildAuthResponse(rotated.user));
});

router.post("/logout", async (req, res) => {
  await revokeRefreshSessionFromRequest(req);
  clearRefreshCookie(res);
  return res.json({ ok: true });
});

export default router;
