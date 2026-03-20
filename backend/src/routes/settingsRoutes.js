import express from "express";
import { protect } from "../middleware/protect.js";
import { authorize, authorizePermission } from "../middleware/authorize.js";
import {
  getSettings,
  updateSettings,
} from "../controllers/settingsController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Settings
 *   description: System settings
 */

/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: Get system settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Settings loaded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AppSettings'
 */
router.get("/", protect, getSettings);

/**
 * @swagger
 * /api/settings:
 *   patch:
 *     summary: Update system settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
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
  protect,
  authorize("admin"),
  authorizePermission("manageSettings"),
  updateSettings,
);

export default router;
