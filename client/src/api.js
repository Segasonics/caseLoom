import toast from "react-hot-toast";

const API_BASE = "https://caseloom.onrender.com";
// "http://localhost:4000";
let hasHandledSessionExpiry = false;
let refreshInFlight = null;

function authHeaders() {
  const token = localStorage.getItem("caseloom_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handleUnauthorized() {
  const token = localStorage.getItem("caseloom_token");
  if (!token || hasHandledSessionExpiry) return;

  hasHandledSessionExpiry = true;
  localStorage.removeItem("caseloom_user");
  localStorage.removeItem("caseloom_token");
  toast.error("Session expired. Please log in again.");

  window.setTimeout(() => {
    window.location.assign("/login");
  }, 120);
}

function isAuthEndpoint(url) {
  const value = String(url);
  return (
    value.includes("/api/auth/login") ||
    value.includes("/api/auth/signup") ||
    value.includes("/api/auth/refresh") ||
    value.includes("/api/auth/logout")
  );
}

function withLatestAccessToken(headers = {}) {
  const next = { ...headers };
  const token = localStorage.getItem("caseloom_token");
  if (token) {
    next.Authorization = `Bearer ${token}`;
  } else {
    delete next.Authorization;
  }
  return next;
}

async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.token) {
      return { error: data?.error || "Session refresh failed" };
    }

    localStorage.setItem("caseloom_token", data.token);
    if (data.user) {
      localStorage.setItem("caseloom_user", JSON.stringify(data.user));
    }
    hasHandledSessionExpiry = false;
    return { ok: true };
  })();

  const result = await refreshInFlight;
  refreshInFlight = null;
  return result;
}

async function apiFetch(url, options = {}, meta = {}) {
  const requestOptions = {
    credentials: "include",
    ...options,
    headers: withLatestAccessToken(options.headers || {}),
  };

  let res = await fetch(url, requestOptions);
  if (res.status !== 401 || meta.skipAuthRefresh || isAuthEndpoint(url)) {
    return res;
  }

  // Attempt one transparent refresh when access token has expired.
  const refreshed = await refreshAccessToken();
  if (!refreshed.error) {
    const retryOptions = {
      ...requestOptions,
      headers: withLatestAccessToken(requestOptions.headers || {}),
    };
    res = await fetch(url, retryOptions);
    if (res.status !== 401) return res;
  }

  handleUnauthorized();
  return res;
}

export async function fetchCases() {
  const res = await apiFetch(`${API_BASE}/api/cases`, {
    headers: { ...authHeaders() },
  });
  return res.json();
}

export async function createCase(payload) {
  const res = await apiFetch(`${API_BASE}/api/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function fetchCaseDetail(id) {
  const res = await apiFetch(`${API_BASE}/api/cases/${id}`, {
    headers: { ...authHeaders() },
  });
  return res.json();
}

export async function createTimelineEvent(caseId, payload) {
  const res = await apiFetch(`${API_BASE}/api/cases/${caseId}/timeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function createDecisionPoint(caseId, payload) {
  const res = await apiFetch(
    `${API_BASE}/api/cases/${caseId}/decision-points`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    },
  );
  return res.json();
}

export async function uploadCaseAttachment(caseId, file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiFetch(`${API_BASE}/api/cases/${caseId}/attachments`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error || "Failed to upload attachment" };
  return data;
}

export async function deleteCaseAttachment(caseId, attachmentId) {
  const res = await apiFetch(
    `${API_BASE}/api/cases/${caseId}/attachments/${attachmentId}`,
    {
      method: "DELETE",
      headers: { ...authHeaders() },
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error || "Failed to delete attachment" };
  return data;
}

export async function fetchCaseAttachmentUrl(caseId, attachmentId) {
  const res = await apiFetch(
    `${API_BASE}/api/cases/${caseId}/attachments/${attachmentId}/url`,
    {
      headers: { ...authHeaders() },
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    return { error: data.error || "Failed to get secure attachment URL" };
  return data;
}

export async function createTask(caseId, payload) {
  const res = await apiFetch(`${API_BASE}/api/cases/${caseId}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function updateTaskStatus(caseId, taskId, status) {
  const res = await apiFetch(
    `${API_BASE}/api/cases/${caseId}/tasks/${taskId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status }),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error || "Failed to update task" };
  return data;
}

export async function deleteTask(caseId, taskId) {
  const res = await apiFetch(
    `${API_BASE}/api/cases/${caseId}/tasks/${taskId}`,
    {
      method: "DELETE",
      headers: { ...authHeaders() },
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error || "Failed to delete task" };
  return data;
}

export async function updateCaseStatus(caseId, status) {
  const res = await apiFetch(`${API_BASE}/api/cases/${caseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error || "Failed to update case" };
  return data;
}

export async function updateCaseTags(caseId, tags) {
  const res = await apiFetch(`${API_BASE}/api/cases/${caseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ tags }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error || "Failed to update tags" };
  return data;
}

export async function deleteCase(caseId) {
  const res = await apiFetch(`${API_BASE}/api/cases/${caseId}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error || "Failed to delete case" };
  return data;
}

export async function fetchCaseShares(caseId) {
  const res = await apiFetch(`${API_BASE}/api/cases/${caseId}/share`, {
    headers: { ...authHeaders() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error || "Failed to load share access" };
  return data;
}

export async function shareCaseWithEmail(caseId, email) {
  const res = await apiFetch(`${API_BASE}/api/cases/${caseId}/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error || "Failed to share case" };
  return data;
}

export async function unshareCaseUser(caseId, userId) {
  const res = await apiFetch(
    `${API_BASE}/api/cases/${caseId}/share/${userId}`,
    {
      method: "DELETE",
      headers: { ...authHeaders() },
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error || "Failed to remove access" };
  return data;
}

export async function fetchAppointments() {
  const res = await apiFetch(`${API_BASE}/api/appointments`, {
    headers: { ...authHeaders() },
  });
  return res.json();
}

export async function createAppointment(payload) {
  const res = await apiFetch(`${API_BASE}/api/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function updateAppointment(appointmentId, payload) {
  const res = await apiFetch(`${API_BASE}/api/appointments/${appointmentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error || "Failed to update appointment" };
  return data;
}

export async function deleteAppointment(appointmentId) {
  const res = await apiFetch(`${API_BASE}/api/appointments/${appointmentId}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error || "Failed to delete appointment" };
  return data;
}

export async function signup(payload) {
  const res = await apiFetch(`${API_BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) hasHandledSessionExpiry = false;
  return data;
}

export async function login(payload) {
  const res = await apiFetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) hasHandledSessionExpiry = false;
  return data;
}

export async function logout() {
  const res = await apiFetch(
    `${API_BASE}/api/auth/logout`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { skipAuthRefresh: true },
  );
  const data = await res.json().catch(() => ({}));
  hasHandledSessionExpiry = false;
  if (!res.ok) return { error: data.error || "Failed to logout" };
  return data;
}

export async function generateCaseSummary(caseId) {
  const res = await apiFetch(`${API_BASE}/api/ai/case-summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ caseId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error || "Failed to generate summary" };
  return data;
}

export async function generateDecisionDraft(caseId, decisionType) {
  const res = await apiFetch(`${API_BASE}/api/ai/decision-draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ caseId, decisionType }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error || "Failed to draft decision" };
  return data;
}

export async function fetchAuditLogs(params = {}) {
  const query = new URLSearchParams();
  if (params.entityType) query.set("entityType", params.entityType);
  if (params.entityId) query.set("entityId", params.entityId);
  if (params.actorEmail) query.set("actorEmail", params.actorEmail);
  if (params.limit) query.set("limit", String(params.limit));

  const res = await apiFetch(`${API_BASE}/api/audit-logs?${query.toString()}`, {
    headers: { ...authHeaders() },
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) return { error: data.error || "Failed to load audit logs" };
  return data;
}
