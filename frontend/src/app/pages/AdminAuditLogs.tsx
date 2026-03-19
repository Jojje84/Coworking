import { useEffect, useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { AuditLogItem } from "../types";
import { AuditLogPageResponse, getAuditLogsApi } from "../../api/auditLogsApi";
import { logger } from "../../utils/logger";
import {
  AuditLogsFilters,
  AuditLogsHeader,
  AuditTableSection,
} from "../components/audit/AuditLogSections";

export function AdminAuditLogs() {
  const { token, socket, isSocketConnected } = useAuth();

  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [actorRoleFilter, setActorRoleFilter] = useState<
    "all" | "admin" | "user"
  >("all");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  useEffect(() => {
    async function loadLogs() {
      if (!token) return;

      setIsLoading(true);
      setError("");

      try {
        const res = await getAuditLogsApi(token, 100);

        const data = (await res.json().catch(() => null)) as
          | AuditLogPageResponse
          | { message?: string }
          | null;

        if (!res.ok) {
          setError(
            (data as { message?: string })?.message ||
              "Could not load audit logs",
          );
          return;
        }

        setItems((data as AuditLogPageResponse).items || []);
      } catch (err) {
        logger.error("load audit logs error:", err);
        setError("Could not load audit logs");
      } finally {
        setIsLoading(false);
      }
    }

    loadLogs();
  }, [token]);

  useEffect(() => {
    if (!socket) return;

    const handleAuditCreated = (payload: AuditLogItem) => {
      if (!payload?.id) return;

      setItems((prev) => {
        if (prev.some((item) => item.id === payload.id)) {
          return prev;
        }

        return [payload, ...prev];
      });
    };

    socket.on("audit:created", handleAuditCreated);

    return () => {
      socket.off("audit:created", handleAuditCreated);
    };
  }, [socket]);

  const actionOptions = useMemo(() => {
    const unique = Array.from(new Set(items.map((item) => item.action))).sort();
    return ["all", ...unique];
  }, [items]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesAction =
        actionFilter === "all" || item.action === actionFilter;
      const actorRole = String(
        item.actor?.role || item.actorRole || "",
      ).toLowerCase();
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
        const role = String(
          item.actor?.role || item.actorRole || "",
        ).toLowerCase();
        return role === "admin";
      }),
    [filtered],
  );

  const userItems = useMemo(
    () =>
      filtered.filter((item) => {
        const role = String(
          item.actor?.role || item.actorRole || "",
        ).toLowerCase();
        return role === "user";
      }),
    [filtered],
  );

  const otherItems = useMemo(
    () =>
      filtered.filter((item) => {
        const role = String(
          item.actor?.role || item.actorRole || "",
        ).toLowerCase();
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

  return (
    <Layout>
      <div className="space-y-8">
        <AuditLogsHeader isLiveConnected={isSocketConnected} />

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <AuditLogsFilters
          search={search}
          actionFilter={actionFilter}
          actorRoleFilter={actorRoleFilter}
          actionOptions={actionOptions}
          onSearchChange={setSearch}
          onActionFilterChange={setActionFilter}
          onActorRoleFilterChange={setActorRoleFilter}
        />

        <div className="rounded-2xl border border-gray-100 bg-white px-6 py-4 text-sm text-gray-500 shadow-sm">
          {isLoading
            ? "Loading audit logs..."
            : `${filtered.length} event(s) shown`}
        </div>

        {isLoading ? null : (
          <div className="space-y-6">
            {shouldRenderAdminSection && (
              <AuditTableSection
                sectionTitle="Admin events"
                sectionItems={adminItems}
                emptyMessage="No matching admin events."
                expandedItemId={expandedItemId}
                onToggleExpanded={(id) =>
                  setExpandedItemId((prev) => (prev === id ? null : id))
                }
              />
            )}
            {shouldRenderUserSection && (
              <AuditTableSection
                sectionTitle="User events"
                sectionItems={userItems}
                emptyMessage="No matching user events."
                expandedItemId={expandedItemId}
                onToggleExpanded={(id) =>
                  setExpandedItemId((prev) => (prev === id ? null : id))
                }
              />
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

        {shouldRenderOtherSection && (
          <AuditTableSection
            sectionTitle="System/unknown events"
            sectionItems={otherItems}
            emptyMessage="No system/unknown events."
            expandedItemId={expandedItemId}
            onToggleExpanded={(id) =>
              setExpandedItemId((prev) => (prev === id ? null : id))
            }
          />
        )}
      </div>
    </Layout>
  );
}
