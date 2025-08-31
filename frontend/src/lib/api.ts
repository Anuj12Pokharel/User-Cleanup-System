// src/lib/api.ts
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
type Tokens = { access: string; refresh: string };

export function saveTokens(t: Tokens) {
  localStorage.setItem("auth_tokens", JSON.stringify(t));
}
export function loadTokens(): Tokens | null {
  const s = localStorage.getItem("auth_tokens");
  return s ? JSON.parse(s) : null;
}
export function clearTokens() {
  localStorage.removeItem("auth_tokens");
}

// refresh access using refresh token; returns new access or null
export async function refreshAccess(): Promise<string | null> {
  const tokens = loadTokens();
  if (!tokens?.refresh) return null;
  try {
    const res = await fetch(`${API_BASE}/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: tokens.refresh }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newTokens: Tokens = { access: data.access, refresh: tokens.refresh };
    saveTokens(newTokens);
    return data.access;
  } catch {
    return null;
  }
}

// central fetch: attaches Authorization Bearer and retries once after refresh on 401
async function apiFetch(path: string, opts: RequestInit = {}, attemptRefresh = true): Promise<Response> {
  const url = `${API_BASE}${path}`;
  const tokens = loadTokens();
  const headers = new Headers(opts.headers || {});
  headers.set("Accept", "application/json");
  if (tokens?.access) headers.set("Authorization", `Bearer ${tokens.access}`);

  let res = await fetch(url, { ...opts, headers });

  if (res.status === 401 && attemptRefresh) {
    const newAccess = await refreshAccess();
    if (!newAccess) return res;
    headers.set("Authorization", `Bearer ${newAccess}`);
    res = await fetch(url, { ...opts, headers });
  }
  return res;
}

// Register -> then login (login returns tokens)
export async function registerUser(payload: { username: string; email: string; password: string }) {
  const res = await fetch(`${API_BASE}/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(JSON.stringify(err));
  }
  // If backend doesn't return tokens on register, attempt login to fetch tokens
  return true;
}

export async function loginUser(payload: { username: string; password: string }) {
  const res = await fetch(`${API_BASE}/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(JSON.stringify(err));
  }
  const data = await res.json();
  // expects { access, refresh }
  saveTokens({ access: data.access, refresh: data.refresh });
  return true;
}

export async function getLatestReport() {
  const res = await apiFetch(`/reports/latest/`);
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Failed to fetch report: ${res.status}`);
  return await res.json();
}

export async function triggerCleanup() {
  const res = await apiFetch(`/cleanup/trigger/`, { method: "POST" });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error(`Failed to trigger: ${res.status}`);
  return await res.json();
}

export function logout() {
  clearTokens();
}
