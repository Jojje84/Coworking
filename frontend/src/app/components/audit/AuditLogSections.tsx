import { Fragment } from "react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { Search, ShieldCheck } from "lucide-react";
import { AuditLogItem } from "../../types";

type AuditChangeRow = {
  field: string;
  before: string;
  after: string;
};

type AuditHeaderProps = {
  isLiveConnected: boolean;
};

type AuditFiltersProps = {
  search: string;
  actionFilter: string;
  actorRoleFilter: "all" | "admin" | "user";
  actionOptions: string[];
  onSearchChange: (value: string) => void;
  onActionFilterChange: (value: string) => void;
  onActorRoleFilterChange: (value: "all" | "admin" | "user") => void;
};

type AuditTableSectionProps = {
  sectionTitle: string;
  sectionItems: AuditLogItem[];
  emptyMessage: string;
  expandedItemId: string | null;
  onToggleExpanded: (id: string) => void;
};

export function formatTargetTypeLabel(targetType: string) {
  const normalized = String(targetType || "")
    .trim()
    .toLowerCase();

  if (normalized === "settings") return "System settings";
  if (normalized === "user") return "User";
  if (normalized === "booking") return "Booking";
  if (normalized === "room") return "Room";
  if (!normalized) return "Unknown";

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function formatShortId(id: string | null) {
  if (!id) return "-";
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

export function formatActionLabel(action: string) {
  const normalized = String(action || "")
    .trim()
    .toLowerCase();

  const labels: Record<string, string> = {
    "settings.updated": "Settings updated",
    "user.updated": "User updated",
    "user.created": "User created",
    "user.soft_deleted": "User soft-deleted",
    "user.restored": "User restored",
    "user.hard_deleted": "User permanently deleted",
    "booking.created": "Booking created",
    "booking.updated": "Booking updated",
    "booking.cancelled": "Booking cancelled",
    "booking.hard_deleted": "Booking permanently deleted",
    "room.created": "Room created",
    "room.updated": "Room updated",
    "room.deleted": "Room deleted",
    "auth.login_succeeded": "Login succeeded",
    "auth.login_failed": "Login failed",
    "auth.login": "Login",
    "auth.register": "Registration",
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

  const fields = Array.from(
    new Set([...Object.keys(previous), ...Object.keys(next)]),
  );

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

export function AuditLogsHeader({ isLiveConnected }: AuditHeaderProps) {
  return (
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
  );
}

export function AuditLogsFilters({
  search,
  actionFilter,
  actorRoleFilter,
  actionOptions,
  onSearchChange,
  onActionFilterChange,
  onActorRoleFilterChange,
}: AuditFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Search
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
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
          onChange={(e) => onActionFilterChange(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          {actionOptions.map((action) => (
            <option key={action} value={action}>
              {action === "all" ? "All events" : formatActionLabel(action)}
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
            onActorRoleFilterChange(e.target.value as "all" | "admin" | "user")
          }
          className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">All roles</option>
          <option value="admin">Admin only</option>
          <option value="user">User only</option>
        </select>
      </div>
    </div>
  );
}

export function AuditTableSection({
  sectionTitle,
  sectionItems,
  emptyMessage,
  expandedItemId,
  onToggleExpanded,
}: AuditTableSectionProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">
          {sectionTitle}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {sectionItems.length} event(s)
        </p>
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
                const metadata = (item.metadata || {}) as Record<
                  string,
                  unknown
                >;
                const changeRows = getAuditChanges(metadata);
                const changedFieldNames = getChangedFieldNames(metadata);
                const hasDetails =
                  changeRows.length > 0 || changedFieldNames.length > 0;
                const isExpanded = expandedItemId === item.id;

                return (
                  <Fragment key={item.id}>
                    <tr className="hover:bg-gray-50/70">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        {format(new Date(item.createdAt), "PPp", {
                          locale: sv,
                        })}
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
                        <div className="text-xs text-gray-500">
                          {item.actor.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div>{item.summary}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {formatTargetTypeLabel(item.targetType)}
                          {item.targetId
                            ? ` · ${formatShortId(item.targetId)}`
                            : ""}
                        </div>
                        {hasDetails && (
                          <button
                            type="button"
                            onClick={() => onToggleExpanded(item.id)}
                            className="mt-2 inline-flex rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                          >
                            {isExpanded ? "Hide details" : "Show details"}
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
                                    <th className="px-2 py-1 text-left font-semibold text-gray-600">
                                      Field
                                    </th>
                                    <th className="px-2 py-1 text-left font-semibold text-gray-600">
                                      Before
                                    </th>
                                    <th className="px-2 py-1 text-left font-semibold text-gray-600">
                                      After
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {changeRows.map((row) => (
                                    <tr key={`${item.id}-${row.field}`}>
                                      <td className="whitespace-nowrap px-2 py-1 font-medium text-gray-800">
                                        {row.field}
                                      </td>
                                      <td className="px-2 py-1 text-gray-600">
                                        {row.before}
                                      </td>
                                      <td className="px-2 py-1 text-gray-800">
                                        {row.after}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-700">
                              Changed fields: {changedFieldNames.join(", ")}
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
}
