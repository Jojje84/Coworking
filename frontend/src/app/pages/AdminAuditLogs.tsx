import { Fragment, useEffect, useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { AuditLogItem } from "../types";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { ShieldCheck, Search } from "lucide-react";
import { io, Socket } from "socket.io-client";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

interface AuditLogPageResponse {
  items: AuditLogItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type AuditChangeRow = {
  field: string;
  before: string;
  after: string;
};

function formatTargetTypeLabel(targetType: string) {
  const normalized = String(targetType || "").trim().toLowerCase();

  if (normalized === "settings") return "System settings";
  if (normalized === "user") return "User";
  if (normalized === "booking") return "Booking";
  if (normalized === "room") return "Room";
  if (!normalized) return "Unknown";

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatShortId(id: string | null) {
  if (!id) return "-";
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

function formatActionLabel(action: string) {
  const normalized = String(action || "").trim().toLowerCase();

  const labels: Record<string, string> = {
    "settings.updated": "Inställningar uppdaterades",
    "user.updated": "Användare uppdaterades",
    "user.created": "Användare skapades",
    "user.soft_deleted": "Användare mjukraderades",
    "user.restored": "Användare återställdes",
    "user.hard_deleted": "Användare raderades permanent",
    "booking.created": "Bokning skapades",
    "booking.updated": "Bokning uppdaterades",
    "booking.cancelled": "Bokning avbokades",
    "booking.hard_deleted": "Bokning raderades permanent",
    "room.created": "Rum skapades",
    "room.updated": "Rum uppdaterades",
    "room.deleted": "Rum raderades",
    "auth.login_succeeded": "Inloggning lyckades",
    "auth.login_failed": "Inloggning misslyckades",
    "auth.login": "Inloggning",
    "auth.register": "Registrering",
  };

  if (labels[normalized]) {
    return labels[normalized];
  }

  const parts = normalized.split(".").filter(Boolean);
  if (parts.length === 2) {
    const [resource, event] = parts;
    return `${resource} ${event}`;
  }

  return action || "Unknown action";
}

function toDisplayValue(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getAuditChanges(metadata: Record<string, unknown>): AuditChangeRow[] {
  const previousRaw = metadata.previous;
  const nextRaw = metadata.next;

  if (
    !previousRaw ||
    !nextRaw ||
    typeof previousRaw !== "object" ||
    typeof nextRaw !== "object"
  ) {
    return [];
  }

  const previous = previousRaw as Record<string, unknown>;
  const next = nextRaw as Record<string, unknown>;

  const fields = Array.from(new Set([...Object.keys(previous), ...Object.keys(next)]));

  return fields
    .filter(
      (field) =>
        JSON.stringify(previous[field]) !== JSON.stringify(next[field]),
    )
    .map((field) => ({
      field,
      before: toDisplayValue(previous[field]),
      after: toDisplayValue(next[field]),
    }));
}

function getChangedFieldNames(metadata: Record<string, unknown>) {
  const raw = metadata.changedFields;

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => (typeof item === "string" ? item : ""))
    .filter(Boolean);
}

export function AdminAuditLogs() {
  const { token } = useAuth();

  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [actorRoleFilter, setActorRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  useEffect(() => {
    async function loadLogs() {
      if (!token) return;

      setIsLoading(true);
      setError("");

      try {
        const res = await fetch(`${API_BASE_URL}/api/audit-logs?limit=100`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = (await res.json().catch(() => null)) as
          | AuditLogPageResponse
          | { message?: string }
          | null;

        if (!res.ok) {
          setError((data as { message?: string })?.message || "Could not load audit logs");
          return;
        }

        setItems((data as AuditLogPageResponse).items || []);
      } catch (err) {
        console.error("load audit logs error:", err);
        setError("Could not load audit logs");
      } finally {
        setIsLoading(false);
      }
    }

    loadLogs();
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const socket: Socket = io(API_BASE_URL, {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      setIsLiveConnected(true);
    });

    socket.on("connect_error", (err) => {
      console.error("audit logs socket connect error:", err.message);
      setIsLiveConnected(false);
    });

    socket.on("disconnect", () => {
      setIsLiveConnected(false);
    });

    socket.on("audit:created", (payload: AuditLogItem) => {
      if (!payload?.id) return;

      setItems((prev) => {
        if (prev.some((item) => item.id === payload.id)) {
          return prev;
        }

        return [payload, ...prev];
      });
    });

    return () => {
      setIsLiveConnected(false);
      socket.disconnect();
    };
  }, [token]);

  const actionOptions = useMemo(() => {
    const unique = Array.from(new Set(items.map((item) => item.action))).sort();
    return ["all", ...unique];
  }, [items]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesAction = actionFilter === "all" || item.action === actionFilter;
      const actorRole = String(item.actor?.role || item.actorRole || "").toLowerCase();
      const matchesActorRole =
        actorRoleFilter === "all" || actorRole === actorRoleFilter;

      if (!matchesAction) return false;
      if (!matchesActorRole) return false;
      if (!query) return true;

      return (
        item.summary.toLowerCase().includes(query) ||
        item.action.toLowerCase().includes(query) ||
        item.actor.username.toLowerCase().includes(query) ||
        item.actor.email.toLowerCase().includes(query) ||
        item.targetType.toLowerCase().includes(query)
      );
    });
  }, [items, search, actionFilter, actorRoleFilter]);

  const adminItems = useMemo(
    () =>
      filtered.filter((item) => {
        const role = String(item.actor?.role || item.actorRole || "").toLowerCase();
        return role === "admin";
      }),
    [filtered],
  );

  const userItems = useMemo(
    () =>
      filtered.filter((item) => {
        const role = String(item.actor?.role || item.actorRole || "").toLowerCase();
        return role === "user";
      }),
    [filtered],
  );

  const otherItems = useMemo(
    () =>
      filtered.filter((item) => {
        const role = String(item.actor?.role || item.actorRole || "").toLowerCase();
        return role !== "admin" && role !== "user";
      }),
    [filtered],
  );

  const showAdminSection = actorRoleFilter !== "user";
  const showUserSection = actorRoleFilter !== "admin";
  const shouldRenderAdminSection =
    showAdminSection && (actorRoleFilter === "admin" || adminItems.length > 0);
  const shouldRenderUserSection =
    showUserSection && (actorRoleFilter === "user" || userItems.length > 0);
  const shouldRenderOtherSection = !isLoading && otherItems.length > 0;

  const renderAuditTable = (
    sectionTitle: string,
    sectionItems: AuditLogItem[],
    emptyMessage: string,
  ) => (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">{sectionTitle}</h2>
        <p className="mt-1 text-sm text-gray-500">{sectionItems.length} event(s)</p>
      </div>

      {sectionItems.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-gray-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Actor
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Summary
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {sectionItems.map((item) => {
                const metadata = (item.metadata || {}) as Record<string, unknown>;
                const changeRows = getAuditChanges(metadata);
                const changedFieldNames = getChangedFieldNames(metadata);
                const hasDetails =
                  changeRows.length > 0 || changedFieldNames.length > 0;
                const isExpanded = expandedItemId === item.id;

                return (
                  <Fragment key={item.id}>
                    <tr className="hover:bg-gray-50/70">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        {format(new Date(item.createdAt), "PPp", { locale: sv })}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span
                          className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700"
                          title={item.action}
                        >
                          {formatActionLabel(item.action)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div className="font-medium">{item.actor.username}</div>
                        <div className="text-xs text-gray-500">{item.actor.email}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div>{item.summary}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {formatTargetTypeLabel(item.targetType)}
                          {item.targetId ? ` · ${formatShortId(item.targetId)}` : ""}
                        </div>
                        {hasDetails && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedItemId((prev) =>
                                prev === item.id ? null : item.id,
                              )
                            }
                            className="mt-2 inline-flex rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                          >
                            {isExpanded ? "Dölj detaljer" : "Visa detaljer"}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && hasDetails && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={4} className="px-6 py-4">
                          {changeRows.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-xs">
                                <thead>
                                  <tr>
                                    <th className="px-2 py-1 text-left font-semibold text-gray-600">Fält</th>
                                    <th className="px-2 py-1 text-left font-semibold text-gray-600">Före</th>
                                    <th className="px-2 py-1 text-left font-semibold text-gray-600">Efter</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {changeRows.map((row) => (
                                    <tr key={`${item.id}-${row.field}`}>
                                      <td className="whitespace-nowrap px-2 py-1 font-medium text-gray-800">{row.field}</td>
                                      <td className="px-2 py-1 text-gray-600">{row.before}</td>
                                      <td className="px-2 py-1 text-gray-800">{row.after}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-700">
                              Ändrade fält: {changedFieldNames.join(", ")}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="space-y-8">
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
            <ShieldCheck className="h-7 w-7" />
            <div>
              <h1 className="text-3xl font-bold">Audit Logs</h1>
              <p className="mt-1 text-sm text-slate-200">
                Review administrative actions and security-relevant events.
              </p>
            </div>
          </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                isLiveConnected
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isLiveConnected ? "bg-emerald-500" : "bg-slate-500"
                }`}
              />
              {isLiveConnected ? "Live connected" : "Live disconnected"}
            </span>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Search summary, actor, action"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Action
            </label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {action === "all" ? "Alla händelser" : formatActionLabel(action)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Actor role
            </label>
            <select
              value={actorRoleFilter}
              onChange={(e) =>
                setActorRoleFilter(e.target.value as "all" | "admin" | "user")
              }
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">Alla roller</option>
              <option value="admin">Endast admin</option>
              <option value="user">Endast user</option>
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white px-6 py-4 text-sm text-gray-500 shadow-sm">
          {isLoading ? "Loading audit logs..." : `${filtered.length} event(s) shown`}
        </div>

        {isLoading ? null : (
          <div className="space-y-6">
            {shouldRenderAdminSection &&
              renderAuditTable(
                "Admin events",
                adminItems,
                "No matching admin events.",
              )}
            {shouldRenderUserSection &&
              renderAuditTable(
                "User events",
                userItems,
                "No matching user events.",
              )}
            {!shouldRenderAdminSection &&
              !shouldRenderUserSection &&
              !shouldRenderOtherSection && (
                <div className="rounded-2xl border border-gray-100 bg-white px-6 py-10 text-center text-sm text-gray-500 shadow-sm">
                  No matching audit events.
                </div>
              )}
          </div>
        )}

        {shouldRenderOtherSection &&
          renderAuditTable(
            "System/unknown events",
            otherItems,
            "No system/unknown events.",
          )}
      </div>
    </Layout>
  );
}
