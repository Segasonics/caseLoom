import crypto from "crypto";
import jwt from "jsonwebtoken";
import { AuthSession } from "../models/AuthSession.js";
import { User } from "../models/User.js";

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 30);
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "caseloom_refresh_token";

function getTokenSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set");
  }
  return process.env.JWT_SECRET;
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function parseCookies(header = "") {
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const eqIndex = part.indexOf("=");
      if (eqIndex === -1) return acc;
      const key = part.slice(0, eqIndex).trim();
      const value = decodeURIComponent(part.slice(eqIndex + 1).trim());
      acc[key] = value;
      return acc;
    }, {});
}

function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role || "doctor" },
    getTokenSecret(),
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

function createRefreshTokenValue() {
  // 64-byte random token; store only hash in DB.
  return crypto.randomBytes(64).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function getRefreshTokenExpiry() {
  return new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
}

function getCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  };
}

export function attachRefreshCookie(res, refreshTokenValue) {
  // httpOnly cookie keeps refresh token out of JavaScript runtime.
  res.cookie(REFRESH_COOKIE_NAME, refreshTokenValue, getCookieOptions());
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export function getRefreshTokenFromRequest(req) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = parseCookies(cookieHeader);
  return cookies[REFRESH_COOKIE_NAME] || "";
}

export async function createSessionForUser({ user, req }) {
  const refreshTokenValue = createRefreshTokenValue();
  const tokenHash = hashToken(refreshTokenValue);
  const session = await AuthSession.create({
    userId: user._id,
    tokenHash,
    expiresAt: getRefreshTokenExpiry(),
    createdFromIp: getClientIp(req),
    userAgent: req.headers["user-agent"] || "",
  });
  return { refreshTokenValue, session };
}

export async function rotateRefreshSession({ req }) {
  const refreshTokenValue = getRefreshTokenFromRequest(req);
  if (!refreshTokenValue) {
    return { error: "Missing refresh token" };
  }

  const currentHash = hashToken(refreshTokenValue);
  const session = await AuthSession.findOne({ tokenHash: currentHash });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    return { error: "Invalid refresh session" };
  }

  const user = await User.findById(session.userId);
  if (!user) {
    return { error: "User not found for refresh session" };
  }

  const newRefreshTokenValue = createRefreshTokenValue();
  const newHash = hashToken(newRefreshTokenValue);

  await AuthSession.create({
    userId: user._id,
    tokenHash: newHash,
    expiresAt: getRefreshTokenExpiry(),
    createdFromIp: getClientIp(req),
    userAgent: req.headers["user-agent"] || "",
  });

  // Rotate token: revoke old session immediately.
  session.revokedAt = new Date();
  session.replacedByHash = newHash;
  await session.save();

  return { user, refreshTokenValue: newRefreshTokenValue };
}

export async function revokeRefreshSessionFromRequest(req) {
  const refreshTokenValue = getRefreshTokenFromRequest(req);
  if (!refreshTokenValue) return;
  const tokenHash = hashToken(refreshTokenValue);
  await AuthSession.updateOne(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

export function buildAuthResponse(user) {
  const token = signAccessToken(user);
  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role || "doctor",
    },
  };
}
