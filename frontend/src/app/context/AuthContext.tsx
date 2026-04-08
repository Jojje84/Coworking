// -------------------------------
// Auth Context
// -------------------------------

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import {
  getSessionApi,
  loginApi,
  logoutApi,
  registerApi,
  updateProfileApi,
} from "../../api/authApi";
import { User } from "../types";
import { logger } from "../../utils/logger";

interface AuthContextType {
  user: User | null;
  token: string | null;
  socket: Socket | null;
  isSocketConnected: boolean;
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
const LS_USER_KEY = "cowork_user";

function mapApiUser(apiUser: any): User {
  return {
    id: apiUser.id ?? apiUser._id ?? "",
    username: apiUser.username ?? "",
    email: apiUser.email ?? "",
    role: apiUser.role?.toLowerCase() === "admin" ? "admin" : "user",
    permissions: {
      bookingHardDelete: Boolean(apiUser.permissions?.bookingHardDelete),
      userHardDelete: Boolean(apiUser.permissions?.userHardDelete),
      manageAdmins: Boolean(apiUser.permissions?.manageAdmins),
      manageSettings: Boolean(apiUser.permissions?.manageSettings),
      viewAuditLogs: Boolean(apiUser.permissions?.viewAuditLogs),
    },
    createdAt: apiUser.createdAt ?? new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const storedUser = localStorage.getItem(LS_USER_KEY);

        if (storedUser) {
          const parsedUser = JSON.parse(storedUser) as User;
          if (parsedUser?.id && parsedUser?.email) {
            setUser(parsedUser);
          } else {
            localStorage.removeItem(LS_USER_KEY);
          }
        }

        const res = await getSessionApi();
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.user) {
          if (!cancelled) {
            setToken(null);
            setUser(null);
            localStorage.removeItem(LS_USER_KEY);
          }
          return;
        }

        const mappedUser = mapApiUser(data.user);
        const restoredToken =
          typeof data?.token === "string" ? data.token.trim() : "";

        if (!restoredToken) {
          if (!cancelled) {
            setToken(null);
            setUser(null);
            localStorage.removeItem(LS_USER_KEY);
          }
          return;
        }

        if (!cancelled) {
          setToken(restoredToken);
          setUser(mappedUser);
          localStorage.setItem(LS_USER_KEY, JSON.stringify(mappedUser));
        }
      } catch (err) {
        logger.error("Failed to restore auth session:", err);
        if (!cancelled) {
          setToken(null);
          setUser(null);
          localStorage.removeItem(LS_USER_KEY);
        }
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveSession = (nextToken: string, nextUser: User) => {
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem(LS_USER_KEY, JSON.stringify(nextUser));
  };

  const saveUserOnly = (nextUser: User) => {
    setUser(nextUser);
    localStorage.setItem(LS_USER_KEY, JSON.stringify(nextUser));
  };

  const clearSession = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(LS_USER_KEY);
  };

  const hasSocketToken = Boolean(token && token.split(".").length === 3);

  useEffect(() => {
    if (!hasSocketToken || !token) {
      setIsSocketConnected(false);
      setSocket((prev) => {
        if (prev) prev.disconnect();
        return null;
      });
      return;
    }

    const nextSocket: Socket = io(API_BASE_URL, {
      auth: { token },
      transports: ["websocket"],
    });

    setSocket(nextSocket);

    const onConnect = () => setIsSocketConnected(true);
    const onDisconnect = () => setIsSocketConnected(false);
    const onConnectError = (err: Error) => {
      logger.error("auth socket connect error:", err.message);
      setIsSocketConnected(false);
    };

    nextSocket.on("connect", onConnect);
    nextSocket.on("disconnect", onDisconnect);
    nextSocket.on("connect_error", onConnectError);

    return () => {
      nextSocket.off("connect", onConnect);
      nextSocket.off("disconnect", onDisconnect);
      nextSocket.off("connect_error", onConnectError);
      nextSocket.disconnect();
      setSocket((prev) => (prev === nextSocket ? null : prev));
      setIsSocketConnected(false);
    };
  }, [hasSocketToken, token]);

  useEffect(() => {
    if (!socket || !user?.id) return;

    const handleUserUpdated = (payload: any) => {
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
    };

    const handleUserDeleted = (payload: any) => {
      if (!payload || payload.id !== user.id) return;

      clearSession();
      toast.error("Your account was removed");
      window.location.replace("/login");
    };

    socket.on("user:updated", handleUserUpdated);
    socket.on("user:deleted", handleUserDeleted);

    return () => {
      socket.off("user:updated", handleUserUpdated);
      socket.off("user:deleted", handleUserDeleted);
    };
  }, [socket, user]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await loginApi({
        email: email.trim(),
        password,
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
      logger.error("login error:", err);
      toast.error("Could not log in");
      return false;
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string,
  ): Promise<boolean> => {
    try {
      const res = await registerApi({
        username: username.trim(),
        email: email.trim(),
        password,
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
      logger.error("register error:", err);
      toast.error("Could not create account");
      return false;
    }
  };

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

      const res = await updateProfileApi(token, data);
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
      logger.error("updateProfile error:", err);
      toast.error("Could not update profile");
      return false;
    }
  };

  const logout = () => {
    const currentToken = token;
    clearSession();
    void logoutApi(currentToken || undefined).catch((err) => {
      logger.error("logout error:", err);
    });
    toast.info("You have been logged out");
  };

  const value = {
    user,
    token,
    socket,
    isSocketConnected,
    login,
    register,
    updateProfile,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
