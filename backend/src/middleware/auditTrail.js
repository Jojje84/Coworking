import { safeRecordAuditLog } from "../services/auditLogService.js";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function normalizeTargetType(rawPath = "") {
  const parts = String(rawPath).split("?")[0].split("/").filter(Boolean);

  const apiIndex = parts[0] === "api" ? 1 : 0;
  const segment = parts[apiIndex] || "system";

  if (segment.endsWith("ies")) {
    return `${segment.slice(0, -3)}y`;
  }

  if (segment.endsWith("s")) {
    return segment.slice(0, -1);
  }

  return segment;
}

function normalizeAction(req, targetType) {
  const method = String(req.method || "").toUpperCase();

  if (method === "POST") return `${targetType}.created`;
  if (method === "PUT" || method === "PATCH") return `${targetType}.updated`;
  if (method === "DELETE") return `${targetType}.deleted`;

  return `${targetType}.changed`;
}

function getTargetIdFromRequest(req) {
  if (req.params?.id) {
    return String(req.params.id);
  }

  if (req.body?.id) {
    return String(req.body.id);
  }

  return null;
}

export function auditWriteRequests(req, res, next) {
  if (!WRITE_METHODS.has(req.method)) {
    return next();
  }

  const startedAt = Date.now();

  res.on("finish", () => {
    if (req._explicitAuditLogged) {
      return;
    }

    if (res.statusCode < 200 || res.statusCode >= 400) {
      return;
    }

    const targetType = normalizeTargetType(req.path || req.originalUrl || "");
    const action = normalizeAction(req, targetType);

    safeRecordAuditLog({
      req,
      action,
      targetType,
      targetId: getTargetIdFromRequest(req),
      summary: `${req.method} ${req.originalUrl} completed`,
      metadata: {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      },
    });
  });

  return next();
}
