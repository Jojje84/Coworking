// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export type UserRole = "user" | "admin";

export interface UserPermissions {
  bookingHardDelete?: boolean;
  userHardDelete?: boolean;
  manageAdmins?: boolean;
  manageSettings?: boolean;
  viewAuditLogs?: boolean;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  permissions?: UserPermissions;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deleteAfter?: string | null;
  createdAt: string;
}

export type RoomType = "workspace" | "conference";

export interface Room {
  id: string;
  name: string;
  capacity: number;
  type: RoomType;
  description: string;
  imageUrl: string;
}

export interface Booking {
  id: string;
  userId: string;
  roomId: string;
  startTime: string;
  endTime: string;
  status: "active" | "completed" | "cancelled";
  createdAt: string;
}

export interface CalendarBooking {
  id: string;
  roomId: string;
  roomName: string;
  startTime: string;
  endTime: string;
  status: "active" | "completed" | "cancelled";
  isMine: boolean;
}

export interface AppSettings {
  id: string;
  allowSelfRegistration: boolean;
  maintenanceMode: boolean;
  adminAnnouncement: string;
  userAnnouncement: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogActor {
  id: string | null;
  username: string;
  email: string;
  role: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  actor: AuditLogActor;
  actorRole: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}
