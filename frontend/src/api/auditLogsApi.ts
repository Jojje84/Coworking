import { AuditLogItem } from "../app/types";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const COOKIE_SESSION_TOKEN = "__cookie_session__";

function authHeaders(token: string) {
  if (!token || token === COOKIE_SESSION_TOKEN) {
    return {};
  }

  return { Authorization: `Bearer ${token}` };
}

export interface AuditLogPageResponse {
  items: AuditLogItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function getAuditLogsApi(token: string, limit = 100): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/audit-logs?limit=${limit}`, {
    credentials: "include",
    headers: { ...authHeaders(token) },
  });
}
