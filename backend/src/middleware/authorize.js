import { requireAdmin } from "./admin.js";
import { requirePermission } from "./permissions.js";

export function authorize(role = "admin") {
  if (String(role).toLowerCase() === "admin") {
    return requireAdmin;
  }

  throw new Error(`Unsupported authorize role: ${role}`);
}

export function authorizePermission(permissionKey) {
  return requirePermission(permissionKey);
}
