// src/app/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import "./home.css";

const STORAGE_KEY = "auth_tokens";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in by looking for auth tokens
    const tokens = localStorage.getItem(STORAGE_KEY);
    setIsLoggedIn(!!tokens);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="home-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <div className="background-animation">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
        <div className="shape shape-4"></div>
      </div>
      
      <section className="hero-panel">
        <div className="panel-content">
          <h1 className="hero-title">
            Welcome to <span className="brand-gradient">Cleanup System</span>
          </h1>
          <p className="hero-subtitle">
            Advanced user management and cleanup solutions with real-time reporting
          </p>
          
          <div className="cta-buttons">
            {!isLoggedIn ? (
              <Link href="/register" className="cta-btn primary">
                Get Started
              </Link>
            ) : (
              <Link href="/dashboard" className="cta-btn primary">
                Go to Dashboard
              </Link>
            )}
            <Link href="/login" className="cta-btn secondary">
              {isLoggedIn ? "Switch Account" : "Sign In"}
            </Link>
          </div>
          
          <div className="quick-links">
            <p>Quick access:</p>
            <div className="link-grid">
              <Link href="/dashboard" className="quick-link">
                <span className="link-icon">📊</span>
                Dashboard
              </Link>
              {!isLoggedIn && (
                <>
                  <Link href="/login" className="quick-link">
                    <span className="link-icon">🔐</span>
                    Login
                  </Link>
                  <Link href="/register" className="quick-link">
                    <span className="link-icon">🚀</span>
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="feature-showcase">
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Fast Cleanup</h3>
            <p>Quickly remove inactive users with automated processes</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📈</div>
            <h3>Detailed Reports</h3>
            <p>Comprehensive analytics on user management activities</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Secure</h3>
            <p>Enterprise-grade security for all your data</p>
          </div>
        </div>
      </section>
    </div>
  );
}