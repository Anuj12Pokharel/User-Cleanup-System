// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginUser } from "../../lib/api";
import "./page.css";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await loginUser(form);
      router.push("/dashboard");
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
        <div className="shape shape-4"></div>
      </div>
      
      <div className="login-card">
        <div className="login-header">
          <h2>Welcome Back</h2>
          <p>Sign in to your account to continue</p>
        </div>
        
        <form onSubmit={submit} className="login-form">
          <div className="input-group">
            <input 
              name="username" 
              placeholder="Username" 
              value={form.username} 
              onChange={handle} 
              className="login-input" 
              required 
            />
            <span className="input-icon">👤</span>
          </div>
          
          <div className="input-group">
            <input 
              name="password" 
              placeholder="Password" 
              type="password" 
              value={form.password} 
              onChange={handle} 
              className="login-input" 
              required 
            />
            <span className="input-icon">🔒</span>
          </div>
          
          <button className="login-btn" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner"></span>
                Logging in...
              </>
            ) : (
              <>
                <span className="btn-icon">→</span>
                Login
              </>
            )}
          </button>
          
          {error && <div className="error-message">{error}</div>}
        </form>
        
        <div className="login-footer">
          <p>Demo Application • User Cleanup System</p>
        </div>
      </div>
    </div>
  );
}