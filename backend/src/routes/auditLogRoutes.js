import express from "express";
import { protect } from "../middleware/protect.js";
import { authorize, authorizePermission } from "../middleware/authorize.js";
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
  protect,
  authorize("admin"),
  authorizePermission("viewAuditLogs"),
  getAuditLogs,
);

export default router;
