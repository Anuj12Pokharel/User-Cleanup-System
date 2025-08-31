"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./page.css";

type Report = {
  id: number;
  timestamp: string;
  users_deleted: number;
  active_users_remaining: number;
};

type CleanupResponse = {
  task_id?: string;
  status?: string;
  message?: string;
  // Add other possible response fields based on your backend
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

const STORAGE_KEY = "auth_tokens";

type Tokens = { access: string; refresh: string };

// Storage utilities (unchanged)
function saveTokens(t: Tokens): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  } catch (e) {
    console.error("saveTokens error", e);
  }
}

function loadTokens(): Tokens | null {
  try {
    if (typeof window === "undefined") return null;
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : null;
  } catch (e) {
    console.error("loadTokens error", e);
    return null;
  }
}

function clearTokens(): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// API utilities
async function apiFetch(
  path: string,
  opts: RequestInit = {}
): Promise<Response> {
  const url = `${API_BASE}${path}`;
  const tokens = loadTokens();
  const headers = new Headers(opts.headers || {});

  headers.set("Accept", "application/json");
  if (tokens?.access) {
    headers.set("Authorization", `Bearer ${tokens.access}`);
  }

  // Add Content-Type for requests with body
  if (opts.body && !(opts.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const res = await fetch(url, {
      ...opts,
      headers,
      credentials: "include",
    });

    if (res.status === 401) {
      clearTokens();
      window.location.href = "/login";
      throw new Error("Unauthorized - please login again");
    }

    return res;
  } catch (e) {
    throw new Error(`Network error: ${e}`);
  }
}

async function getLatestReport(): Promise<Report | null> {
  try {
    const res = await apiFetch(`/reports/latest/`);

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "No error details");
      throw new Error(`Failed to fetch latest report: ${res.status} ${text}`);
    }

    return await res.json();
  } catch (error) {
    console.error("Error fetching report:", error);
    throw error;
  }
}

async function triggerCleanup(): Promise<CleanupResponse> {
  try {
    const res = await apiFetch(`/cleanup/trigger/`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      throw new Error(`Server responded with status ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    
    // Handle different response formats
    if (data.task_id) {
      return { task_id: data.task_id };
    } else if (data.status === "success" || data.message) {
      // Handle cases where cleanup completes immediately
      return { 
        status: data.status || "completed", 
        message: data.message || "Cleanup completed successfully" 
      };
    } else {
      // Fallback for unexpected response formats
      return { status: "unknown", message: "Cleanup triggered" };
    }
  } catch (error) {
    console.error("Error triggering cleanup:", error);
    throw error;
  }
}

export default function DashboardPage(): JSX.Element {
  const router = useRouter();
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [loadingTrigger, setLoadingTrigger] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [cleanupStatus, setCleanupStatus] = useState<string | null>(null);

  // Check authentication on mount and load initial data
  useEffect(() => {
    const tokens = loadTokens();
    if (!tokens) {
      router.push("/login");
    } else {
      fetchLatest();
    }
  }, [router]);

  const fetchLatest = useCallback(async () => {
    setLoadingLatest(true);
    setError(null);

    try {
      const r = await getLatestReport();
      setReport(r);
    } catch (e: any) {
      const errorMsg = e.message || "Failed to fetch latest report";
      setError(errorMsg);
    } finally {
      setLoadingLatest(false);
    }
  }, []);

  const onTrigger = useCallback(async () => {
    setLoadingTrigger(true);
    setError(null);
    setTaskId(null);
    setCleanupStatus(null);

    try {
      const payload = await triggerCleanup();

      if (payload.task_id) {
        setTaskId(payload.task_id);
        setCleanupStatus("Cleanup task started");
        setTimeout(() => fetchLatest(), 2000);
      } else if (payload.status || payload.message) {
        setCleanupStatus(payload.message || `Cleanup status: ${payload.status}`);
        // Refresh immediately if cleanup completed
        setTimeout(() => fetchLatest(), 1000);
      } else {
        setCleanupStatus("Cleanup triggered");
        setTimeout(() => fetchLatest(), 1000);
      }
    } catch (e: any) {
      const errorMsg = e.message || "Failed to trigger cleanup";
      setError(errorMsg);
    } finally {
      setLoadingTrigger(false);
    }
  }, [fetchLatest]);

  const onLogout = () => {
    clearTokens();
    router.push("/login");
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <button onClick={onLogout} className="btn ghost logout-btn" aria-label="Logout">
          <span className="btn-icon">→</span>
          Logout
        </button>

        <div className="header-content">
          <div className="header-info">
            <h2>Cleanup Dashboard</h2>
          </div>

          <div className="header-actions">
            <button
              onClick={() => fetchLatest()}
              disabled={loadingLatest}
              className="btn outline refresh-btn"
              aria-disabled={loadingLatest}
            >
              <span className="btn-icon">↻</span>
              {loadingLatest ? "Fetching..." : "Get Latest Report"}
            </button>
          </div>
        </div>
      </div>

      <div className="trigger-section">
        <div className="trigger-actions">
          <button
            onClick={onTrigger}
            disabled={loadingTrigger}
            className="btn primary trigger-btn"
            aria-disabled={loadingTrigger}
          >
            <span className="btn-icon">⚡</span>
            {loadingTrigger ? "Triggering..." : "Trigger Cleanup"}
          </button>
        </div>

        {taskId && (
          <div className="task-notification">
            <strong>Task enqueued:</strong> <code>{taskId}</code>
          </div>
        )}
        
        {cleanupStatus && !taskId && (
          <div className="status-notification">
            {cleanupStatus}
          </div>
        )}
      </div>

      <div className="dashboard-content">
        {error && (
          <div className="error-message" role="alert">
            {error}
            <button onClick={() => setError(null)} className="error-dismiss">
              ×
            </button>
          </div>
        )}

        {!report && !loadingLatest && (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>No reports yet</h3>
            <p>Click <strong>Trigger Cleanup</strong> to generate your first report</p>
          </div>
        )}

        {report && (
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">🕒</span>
                <span className="metric-title">Timestamp</span>
              </div>
              <div className="metric-value">{new Date(report.timestamp).toLocaleString()}</div>
            </div>
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-icon">❌</span>
                <span className="metric-title">Users Deleted</span>
              </div>
              <div className="metric-value highlight-danger">{report.users_deleted}</div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}