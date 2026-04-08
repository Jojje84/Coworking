import { AppSettings } from "../app/types";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const COOKIE_SESSION_TOKEN = "__cookie_session__";

function authHeaders(token: string) {
  if (!token || token === COOKIE_SESSION_TOKEN) {
    return {};
  }

  return { Authorization: `Bearer ${token}` };
}

type SettingsUpdatePayload = {
  allowSelfRegistration: boolean;
  maintenanceMode: boolean;
  adminAnnouncement: string;
  userAnnouncement: string;
};

export function getSettingsApi(token: string): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/settings`, {
    credentials: "include",
    headers: { ...authHeaders(token) },
  });
}

export function updateSettingsApi(
  token: string,
  payload: SettingsUpdatePayload,
): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/settings`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  });
}

export function parseSettingsResponse(data: any): AppSettings {
  return {
    id: data?.id ?? data?._id ?? "",
    allowSelfRegistration: Boolean(data?.allowSelfRegistration),
    maintenanceMode: Boolean(data?.maintenanceMode),
    adminAnnouncement: String(data?.adminAnnouncement || ""),
    userAnnouncement: String(data?.userAnnouncement || ""),
    updatedBy: data?.updatedBy ?? null,
    createdAt: data?.createdAt ?? new Date().toISOString(),
    updatedAt: data?.updatedAt ?? new Date().toISOString(),
  };
}
