import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { getSettingsApi, parseSettingsResponse } from "../../api/settingsApi";
import { logger } from "../../utils/logger";

type SettingsContextType = {
  adminAnnouncement: string;
  userAnnouncement: string;
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { token, user, socket } = useAuth();
  const [adminAnnouncement, setAdminAnnouncement] = useState("");
  const [userAnnouncement, setUserAnnouncement] = useState("");

  useEffect(() => {
    if (!token || !user) {
      setAdminAnnouncement("");
      setUserAnnouncement("");
      return;
    }

    async function loadAnnouncements() {
      try {
        const res = await getSettingsApi(token);

        if (!res.ok) {
          setAdminAnnouncement("");
          setUserAnnouncement("");
          return;
        }

        const data = await res.json().catch(() => null);
        const parsed = parseSettingsResponse(data);
        setAdminAnnouncement(String(parsed.adminAnnouncement || "").trim());
        setUserAnnouncement(String(parsed.userAnnouncement || "").trim());
      } catch (err) {
        logger.error("loadAnnouncements error:", err);
        setAdminAnnouncement("");
        setUserAnnouncement("");
      }
    }

    loadAnnouncements();
  }, [token, user, user?.id, user?.role]);

  useEffect(() => {
    if (!socket) return;

    const handleSettingsUpdated = (payload: any) => {
      setAdminAnnouncement(String(payload?.adminAnnouncement || "").trim());
      setUserAnnouncement(String(payload?.userAnnouncement || "").trim());
    };

    socket.on("settings:updated", handleSettingsUpdated);

    return () => {
      socket.off("settings:updated", handleSettingsUpdated);
    };
  }, [socket]);

  const value = {
    adminAnnouncement,
    userAnnouncement,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
