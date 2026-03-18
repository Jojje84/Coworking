import { AuditLog } from "../models/AuditLog.js";

function toAuditLogResponse(log) {
  return {
    id: log._id.toString(),
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    summary: log.summary,
    metadata: log.metadata || {},
    actor: log.actorId
      ? {
          id: log.actorId._id?.toString?.() || log.actorId.toString(),
          username: log.actorId.username || "Unknown",
          email: log.actorId.email || "",
          role: log.actorId.role || log.actorRole || "unknown",
        }
      : {
          id: null,
          username: "Unknown",
          email: "",
          role: log.actorRole || "unknown",
        },
    actorRole: log.actorRole,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt,
  };
}

export async function recordAuditLog({
  req,
  action,
  actorId = null,
  actorRole = null,
  targetType = "system",
  targetId = null,
  summary,
  metadata = {},
}) {
  if (!action || !summary) return;

  if (req) {
    req._explicitAuditLogged = true;
  }

  const resolvedActorId = actorId || req?.user?.id || null;
  const resolvedActorRole = actorRole || req?.user?.role || "unknown";

  const createdLog = await AuditLog.create({
    actorId: resolvedActorId,
    actorRole: resolvedActorRole,
    action,
    targetType,
    targetId: targetId ? String(targetId) : null,
    summary,
    metadata,
    ipAddress: req?.ip || "",
    userAgent: req?.headers?.["user-agent"] || "",
  });

  const io = req?.app?.get?.("io");
  if (io) {
    const populated = await createdLog.populate("actorId", "username email role");
    io.to("admins").emit("audit:created", toAuditLogResponse(populated));
  }
}

export async function safeRecordAuditLog(payload) {
  try {
    await recordAuditLog(payload);
  } catch (err) {
    console.error("audit log write failed:", err);
  }
}
