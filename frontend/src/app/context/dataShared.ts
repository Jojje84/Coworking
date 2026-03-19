import { Booking, CalendarBooking, Room, User } from "../types";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export function authHeaders(token: string | null): HeadersInit {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export const mapRoomTypeFromApi = (t: string) => t;
export const mapRoomTypeToApi = (t: string) => t;

export function normalizeId(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value._id !== undefined && value._id !== null) {
      return String(value._id);
    }
    if (value.id !== undefined && value.id !== null) {
      return String(value.id);
    }
  }
  return String(value);
}

export function mapBookingFromApi(b: any): Booking {
  return {
    id: normalizeId(b._id ?? b.id),
    userId: normalizeId(b.userId?._id ?? b.userId),
    roomId: normalizeId(b.roomId?._id ?? b.roomId),
    startTime: new Date(b.startTime).toISOString(),
    endTime: new Date(b.endTime).toISOString(),
    status: b.status ?? "active",
    createdAt: b.createdAt
      ? new Date(b.createdAt).toISOString()
      : new Date().toISOString(),
  };
}

export function mapCalendarBookingFromApi(b: any): CalendarBooking {
  return {
    id: b._id ?? b.id,
    roomId: b.roomId?._id ?? b.roomId,
    roomName: b.roomName ?? b.roomId?.name ?? "Unknown room",
    startTime: new Date(b.startTime).toISOString(),
    endTime: new Date(b.endTime).toISOString(),
    status: b.status ?? "active",
    isMine: Boolean(b.isMine),
  };
}

export function mapUserFromApi(u: any): User {
  return {
    id: u._id ?? u.id,
    username: u.username ?? "",
    email: u.email ?? "",
    role: u.role?.toLowerCase() === "admin" ? "admin" : "user",
    permissions: {
      bookingHardDelete: Boolean(u.permissions?.bookingHardDelete),
      userHardDelete: Boolean(u.permissions?.userHardDelete),
      manageAdmins: Boolean(u.permissions?.manageAdmins),
      manageSettings: Boolean(u.permissions?.manageSettings),
      viewAuditLogs: Boolean(u.permissions?.viewAuditLogs),
    },
    isDeleted: Boolean(u.isDeleted),
    deletedAt: u.deletedAt ? new Date(u.deletedAt).toISOString() : null,
    deleteAfter: u.deleteAfter ? new Date(u.deleteAfter).toISOString() : null,
    createdAt: u.createdAt
      ? new Date(u.createdAt).toISOString()
      : new Date().toISOString(),
  };
}

export function mapRoomFromApi(r: any): Room {
  return {
    id: r._id ?? r.id,
    name: r.name,
    capacity: r.capacity,
    type: mapRoomTypeFromApi(r.type) as Room["type"],
    description: r.description ?? "",
    imageUrl: r.imageUrl ?? "",
  };
}
