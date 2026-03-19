// context/AuthContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthReady: boolean;
  login: (email: string, password: string) => Promise<true | string>;
  register: (name: string, email: string, password: string) => Promise<true | string>;
  logout: () => void;
  deleteAccount: () => Promise<boolean>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser]   = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const savedUser  = localStorage.getItem("user");
      const savedToken = localStorage.getItem("token");
      if (savedUser && savedToken) {
        setUser(JSON.parse(savedUser) as User);
        setToken(savedToken);
      }
    } catch {
      setUser(null);
      setToken(null);
    } finally {
      setIsAuthReady(true);
    }
  }, []);

  const persistSession = (u: User, t: string) => {
    setUser(u);
    setToken(t);
    localStorage.setItem("user", JSON.stringify(u));
    localStorage.setItem("token", t);
  };

  const clearSession = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  const login = async (email: string, password: string): Promise<true | string> => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { message?: string };
        return errBody.message ?? "Invalid email or password.";
      }

      const data = await res.json() as { token: string; user: User };
      persistSession(data.user, data.token);
      return true;
    } catch {
      return "Network error. Is the server running?";
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string
  ): Promise<true | string> => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { message?: string };
        return errBody.message ?? "Registration failed. Please try again.";
      }

      const data = await res.json() as { token?: string; user?: User };

      if (data.token && data.user) {
        persistSession(data.user, data.token);
        return true;
      }

      const loginResult = await login(email, password);
      return loginResult === true ? true : "Account created but login failed. Please log in manually.";
    } catch {
      return "Network error. Is the server running?";
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearSession();
    localStorage.removeItem("scanHistory");
  };

  const deleteAccount = async (): Promise<boolean> => {
  setLoading(true);
  try {
    if (token && user) {
      const res = await fetch(`${API_BASE}/delete_account/${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        console.error("Delete failed:", data.message);
        return false; // Don't clear session if backend failed
      }
    }

    clearSession();
    localStorage.removeItem("scanHistory");
    return true;
  } catch (err) {
    console.error("Delete account error:", err);
    return false;
  } finally {
    setLoading(false);
  }
};

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthReady, login, register, logout, deleteAccount, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
};