import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import { requirePermission } from "../middleware/permissions.js";
import { getAuditLogs } from "../controllers/auditLogController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Audit Logs
 *   description: System audit event history
 */

/**
 * @swagger
 * /api/audit-logs:
 *   get:
 *     summary: Get audit logs
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: targetType
 *         schema:
 *           type: string
 *       - in: query
 *         name: actorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: actorRole
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Audit log page
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuditLogPage'
 */
router.get(
  "/",
  requireAuth,
  requireAdmin,
  requirePermission("viewAuditLogs"),
  getAuditLogs,
);

export default router;
