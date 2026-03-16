// ─────────────────────────────────────────
// Auth Context
// ─────────────────────────────────────────

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import { User } from "../types";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (
    username: string,
    email: string,
    password: string,
  ) => Promise<boolean>;
  updateProfile: (data: {
    username?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  }) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const LS_TOKEN_KEY = "cowork_token";
const LS_USER_KEY = "cowork_user";

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function mapApiUser(apiUser: any): User {
  return {
    id: apiUser.id ?? apiUser._id ?? "",
    username: apiUser.username ?? "",
    email: apiUser.email ?? "",
    role: apiUser.role?.toLowerCase() === "admin" ? "admin" : "user",
    createdAt: apiUser.createdAt ?? new Date().toISOString(),
  };
}

// ─────────────────────────────────────────
// AuthProvider
// ─────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // ─────────────────────────────────────────
  // Restore Session from LocalStorage
  // ─────────────────────────────────────────

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(LS_TOKEN_KEY);
      const storedUser = localStorage.getItem(LS_USER_KEY);

      if (!storedToken || !storedUser) return;

      const parsedUser = JSON.parse(storedUser) as User;

      if (!parsedUser?.id || !parsedUser?.email) {
        localStorage.removeItem(LS_TOKEN_KEY);
        localStorage.removeItem(LS_USER_KEY);
        return;
      }

      setToken(storedToken);
      setUser(parsedUser);
    } catch (err) {
      console.error("Failed to restore auth session:", err);
      localStorage.removeItem(LS_TOKEN_KEY);
      localStorage.removeItem(LS_USER_KEY);
    }
  }, []);

  const saveSession = (nextToken: string, nextUser: User) => {
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem(LS_TOKEN_KEY, nextToken);
    localStorage.setItem(LS_USER_KEY, JSON.stringify(nextUser));
  };

  const saveUserOnly = (nextUser: User) => {
    setUser(nextUser);
    localStorage.setItem(LS_USER_KEY, JSON.stringify(nextUser));
  };

  const clearSession = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(LS_TOKEN_KEY);
    localStorage.removeItem(LS_USER_KEY);
  };

  // ─────────────────────────────────────────
  // Socket.IO — Real-time Profile Updates
  // ─────────────────────────────────────────

  useEffect(() => {
    if (!token || !user?.id) return;

    const socket: Socket = io(API_BASE_URL, {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("connect_error", (err) => {
      console.error("auth socket connect error:", err.message);
    });

    socket.on("user:updated", (payload: any) => {
      if (!payload || payload.id !== user.id) return;

      const nextUser = mapApiUser({
        ...user,
        ...payload,
      });

      const wasAdmin = user.role === "admin";
      const isAdmin = nextUser.role === "admin";

      saveUserOnly(nextUser);

      if (wasAdmin && !isAdmin) {
        toast.error("Your admin permissions were removed");

        if (window.location.pathname.startsWith("/admin")) {
          window.location.replace("/");
        }
        return;
      }

      toast.success("Your account was updated");
    });

    socket.on("user:deleted", (payload: any) => {
      if (!payload || payload.id !== user.id) return;

      clearSession();
      toast.error("Your account was removed");
      window.location.replace("/login");
    });

    return () => {
      socket.disconnect();
    };
  }, [token, user]);

  // ─────────────────────────────────────────
  // Login
  // ─────────────────────────────────────────

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(data?.message ?? "Incorrect email or password");
        return false;
      }

      if (!data?.token || !data?.user) {
        toast.error("Invalid login response from server");
        return false;
      }

      const mappedUser = mapApiUser(data.user);
      saveSession(data.token, mappedUser);

      toast.success(`Welcome back, ${mappedUser.username}!`);
      return true;
    } catch (err) {
      console.error("login error:", err);
      toast.error("Could not log in");
      return false;
    }
  };

  // ─────────────────────────────────────────
  // Register
  // ─────────────────────────────────────────

  const register = async (
    username: string,
    email: string,
    password: string,
  ): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(data?.message ?? "Could not create account");
        return false;
      }

      const autoLoginSuccess = await login(email, password);

      if (!autoLoginSuccess) {
        toast.error("Account created, but automatic sign-in failed");
        return false;
      }

      return true;
    } catch (err) {
      console.error("register error:", err);
      toast.error("Could not create account");
      return false;
    }
  };

  // ─────────────────────────────────────────
  // Update Profile
  // ─────────────────────────────────────────

  const updateProfile = async (data: {
    username?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  }): Promise<boolean> => {
    try {
      if (!token) {
        toast.error("You are not logged in");
        return false;
      }

      const res = await fetch(`${API_BASE_URL}/api/users/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const result = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(result?.message ?? "Could not update profile");
        return false;
      }

      const updatedUser = mapApiUser(result);
      saveUserOnly(updatedUser);

      toast.success("Profile updated successfully");
      return true;
    } catch (err) {
      console.error("updateProfile error:", err);
      toast.error("Could not update profile");
      return false;
    }
  };

  // ─────────────────────────────────────────
  // Logout
  // ─────────────────────────────────────────

  const logout = () => {
    clearSession();
    toast.info("You have been logged out");
  };

  const value = useMemo(
    () => ({ user, token, login, register, updateProfile, logout }),
    [user, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─────────────────────────────────────────
// useAuth Hook
// ─────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
