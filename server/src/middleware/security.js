// In-memory security controls for development/small deployments.
// For multi-instance production, move these counters to Redis.

const limiterStores = new Map();
const loginAttemptStore = new Map();

function getStore(namespace) {
  if (!limiterStores.has(namespace)) {
    limiterStores.set(namespace, new Map());
  }
  return limiterStores.get(namespace);
}

function getClientIp(req) {
  // Prefer x-forwarded-for when behind a reverse proxy/load balancer.
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function toInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function pruneOldEntries(store, maxAgeMs) {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (now - value.windowStart > maxAgeMs) {
      store.delete(key);
    }
  }
}

export function createRateLimiter({
  namespace,
  windowMs,
  max,
  keyFn,
  message = "Too many requests. Please try again later.",
}) {
  const store = getStore(namespace);

  return (req, res, next) => {
    const now = Date.now();
    const key = keyFn ? keyFn(req) : getClientIp(req);
    const entry = store.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
      store.set(key, { count: 1, windowStart: now });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfterSeconds = Math.ceil((windowMs - (now - entry.windowStart)) / 1000);
      res.setHeader("Retry-After", String(Math.max(retryAfterSeconds, 1)));
      return res.status(429).json({
        error: message,
        retryAfterSeconds: Math.max(retryAfterSeconds, 1),
      });
    }

    // Opportunistic cleanup to keep memory bounded.
    if (Math.random() < 0.02) {
      pruneOldEntries(store, windowMs * 2);
    }

    return next();
  };
}

const authWindowMs = toInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
const authMaxRequests = toInt(process.env.AUTH_RATE_LIMIT_MAX, 20);

export const authRateLimiter = createRateLimiter({
  namespace: "auth",
  windowMs: authWindowMs,
  max: authMaxRequests,
  message: "Too many auth requests. Please wait before retrying.",
});

const writeWindowMs = toInt(process.env.WRITE_RATE_LIMIT_WINDOW_MS, 60 * 1000);
const writeMaxRequests = toInt(process.env.WRITE_RATE_LIMIT_MAX, 120);
const writeLimiter = createRateLimiter({
  namespace: "write",
  windowMs: writeWindowMs,
  max: writeMaxRequests,
  message: "Too many write requests. Please slow down.",
});

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function writeRateLimiter(req, res, next) {
  // Only rate-limit mutating endpoints.
  if (!WRITE_METHODS.has(req.method)) {
    return next();
  }
  return writeLimiter(req, res, next);
}

const loginMaxFailedAttempts = toInt(process.env.AUTH_MAX_FAILED_ATTEMPTS, 5);
const loginLockMs = toInt(process.env.AUTH_LOCK_WINDOW_MS, 15 * 60 * 1000);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function buildLoginAttemptKey(req) {
  // Bind lockout to IP + email to reduce account brute-force.
  return `${getClientIp(req)}|${normalizeEmail(req.body?.email) || "unknown"}`;
}

export function checkLoginLock(req, res, next) {
  const key = buildLoginAttemptKey(req);
  req.loginAttemptKey = key;

  const entry = loginAttemptStore.get(key);
  if (!entry) return next();

  if (entry.lockUntil && entry.lockUntil > Date.now()) {
    const retryAfterSeconds = Math.ceil((entry.lockUntil - Date.now()) / 1000);
    res.setHeader("Retry-After", String(Math.max(retryAfterSeconds, 1)));
    return res.status(429).json({
      error: "Too many failed login attempts. Try again later.",
      retryAfterSeconds: Math.max(retryAfterSeconds, 1),
    });
  }

  // Clear expired lock entries.
  if (entry.lockUntil && entry.lockUntil <= Date.now()) {
    loginAttemptStore.delete(key);
  }

  return next();
}

export function recordLoginFailure(req) {
  const key = req.loginAttemptKey || buildLoginAttemptKey(req);
  const now = Date.now();
  const existing = loginAttemptStore.get(key);

  if (!existing || (existing.lockUntil && existing.lockUntil <= now)) {
    loginAttemptStore.set(key, { count: 1, lockUntil: null });
    return;
  }

  existing.count += 1;
  if (existing.count >= loginMaxFailedAttempts) {
    // Lock this IP+email pair for a cooldown period.
    existing.lockUntil = now + loginLockMs;
    existing.count = 0;
  }
}

export function clearLoginFailures(req) {
  const key = req.loginAttemptKey || buildLoginAttemptKey(req);
  loginAttemptStore.delete(key);
}
