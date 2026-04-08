export const PERMISSION_KEYS = [
  "bookingHardDelete",
  "userHardDelete",
  "manageAdmins",
  "manageSettings",
  "viewAuditLogs",
];

export function emptyPermissions() {
  return {
    bookingHardDelete: false,
    userHardDelete: false,
    manageAdmins: false,
    manageSettings: false,
    viewAuditLogs: false,
  };
}

export function toPermissionResponse(permissions) {
  const base = emptyPermissions();

  for (const key of PERMISSION_KEYS) {
    base[key] = Boolean(permissions?.[key]);
  }

  return base;
}

export function hasPermission(user, permissionKey) {
  if (!PERMISSION_KEYS.includes(permissionKey)) return false;
  return Boolean(user?.permissions?.[permissionKey]);
}

export function canManagePermissions(user) {
  return hasPermission(user, "manageAdmins");
}

export function buildPermissionsForRole(role, inputPermissions = {}) {
  const normalizedRole = (role || "").toLowerCase();

  if (normalizedRole !== "admin") {
    return emptyPermissions();
  }

  return toPermissionResponse(inputPermissions);
}

export function parsePermissionPatch(body = {}) {
  const patch = {};
  const invalid = [];

  const nestedPermissions =
    typeof body.permissions === "object" && body.permissions !== null
      ? body.permissions
      : {};

  for (const key of PERMISSION_KEYS) {
    const hasTopLevelValue = Object.prototype.hasOwnProperty.call(body, key);
    const hasNestedValue = Object.prototype.hasOwnProperty.call(
      nestedPermissions,
      key,
    );

    if (!hasTopLevelValue && !hasNestedValue) {
      continue;
    }

    const value = hasTopLevelValue ? body[key] : nestedPermissions[key];

    if (typeof value !== "boolean") {
      invalid.push(key);
      continue;
    }

    patch[key] = value;
  }

  return { patch, invalid };
}
