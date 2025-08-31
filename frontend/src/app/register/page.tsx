"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { registerUser, loginUser } from "../../lib/api";
import "./page.css";

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));

  const passwordsMatch = form.password.length > 0 && form.password === form.confirmPassword;

  const isFormComplete =
    form.username.trim() !== "" && form.email.trim() !== "" && form.password.trim() !== "";

  // password score 0..4
  const pwScore = useMemo(() => {
    const p = form.password || "";
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return Math.min(4, Math.max(0, s));
  }, [form.password]);

  const pwClass = pwScore <= 1 ? "weak" : pwScore === 2 ? "fair" : pwScore === 3 ? "good" : "strong";
  const pwLabel = ["Too short", "Weak", "Fair", "Good", "Strong"][pwScore];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isFormComplete) {
      setError("Please complete all required fields.");
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      // only send fields backend needs
      await registerUser({ username: form.username, email: form.email, password: form.password });

      try {
        await loginUser({ username: form.username, password: form.password });
        router.push("/dashboard");
      } catch {
        router.push("/login");
      }
    } catch (err: any) {
      setError(String(err || "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel auth-panel" role="region" aria-labelledby="signup-title">
      <h2 id="signup-title">Create your account</h2>

      <form onSubmit={submit} className="form" noValidate>
        {/* Username */}
        <div className="field-wrap">
          <input
            id="username"
            name="username"
            value={form.username}
            onChange={handle}
            className="field"
            placeholder=" "
            aria-label="Username"
            required
          />
          <label htmlFor="username" className="field-label">Username</label>
        </div>

        {/* Email */}
        <div className="field-wrap">
          <input
            id="email"
            name="email"
            value={form.email}
            onChange={handle}
            className="field"
            placeholder=" "
            type="email"
            aria-label="Email address"
            required
          />
          <label htmlFor="email" className="field-label">Email</label>
        </div>

        {/* Password */}
        <div className="field-wrap">
          <input
            id="password"
            name="password"
            value={form.password}
            onChange={handle}
            className={`field ${form.password.length ? (pwScore >= 3 ? "success" : "error") : ""}`}
            placeholder=" "
            type={showPassword ? "text" : "password"}
            aria-describedby="pw-desc"
            aria-label="Password"
            required
          />
          <label htmlFor="password" className="field-label">Password</label>

          <div className="field-control" aria-hidden>
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-pressed={showPassword}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.4"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.4"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Strength pill */}
        <div id="pw-desc" className="pw-meter" aria-live="polite">
          <div className={`pw-pill ${pwClass}`} aria-hidden>{pwLabel}</div>
          <div style={{ color: "#64748b", fontSize: 13 }}>{form.password.length ? `${form.password.length} chars` : ""}</div>
        </div>

        {/* Confirm */}
        <div className="field-wrap">
          <input
            id="confirmPassword"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handle}
            className={`field ${form.confirmPassword.length ? (passwordsMatch ? "success" : "error") : ""}`}
            placeholder=" "
            type={showConfirm ? "text" : "password"}
            aria-label="Confirm password"
            required
          />
          <label htmlFor="confirmPassword" className="field-label">Confirm password</label>

          <div className="field-control" aria-hidden>
            <button
              type="button"
              onClick={() => setShowConfirm((s) => !s)}
              aria-pressed={showConfirm}
              title={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? (
                <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.6"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.4"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.4"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* inline match hint */}
        {form.confirmPassword.length > 0 && (
          <div className={`password-hint ${passwordsMatch ? "match" : "nomatch"}`} role="status" aria-live="polite">
            {passwordsMatch ? "Passwords match" : "Passwords do not match"}
          </div>
        )}

        <button
          className="btn primary"
          type="submit"
          disabled={loading || !isFormComplete || !passwordsMatch}
          aria-disabled={loading || !isFormComplete || !passwordsMatch}
        >
          {loading ? "Registering..." : "Create account"}
        </button>

        {error && <div className="error" role="alert">{error}</div>}

        <div className="small-note">Use at least 8 characters. Add uppercase, numbers, or symbols for a stronger password.</div>
      </form>
    </div>
  );
}
