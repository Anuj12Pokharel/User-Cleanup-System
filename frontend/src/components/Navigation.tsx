// src/components/Navigation.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "auth_tokens";

export default function Navigation() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in by looking for auth tokens
    const tokens = localStorage.getItem(STORAGE_KEY);
    setIsLoggedIn(!!tokens);
    setIsLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setIsLoggedIn(false);
    // Redirect to home page after logout
    window.location.href = "/";
  };

  if (isLoading) {
    return (
      <nav className="nav">
        <Link href="/">Home</Link>
        <Link href="/dashboard">Dashboard</Link>
      </nav>
    );
  }

  return (
    <nav className="nav">
      <Link href="/">Home</Link>
      {!isLoggedIn && (
        <>
          <Link href="/register">Register</Link>
          <Link href="/login">Login</Link>
        </>
      )}
      <Link href="/dashboard">Dashboard</Link>
      {isLoggedIn && (
        <button onClick={handleLogout} className="logout-link">
          Logout
        </button>
      )}
    </nav>
  );
}