import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import { requirePermission } from "../middleware/permissions.js";
import { getSettings, updateSettings } from "../controllers/settingsController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Settings
 *   description: Admin system settings
 */

/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: Get system settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings loaded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AppSettings'
 */
router.get(
  "/",
  requireAuth,
  getSettings,
);

/**
 * @swagger
 * /api/settings:
 *   patch:
 *     summary: Update system settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppSettingsUpdateInput'
 *     responses:
 *       200:
 *         description: Settings updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AppSettings'
 */
router.patch(
  "/",
  requireAuth,
  requireAdmin,
  requirePermission("manageSettings"),
  updateSettings,
);

export default router;
