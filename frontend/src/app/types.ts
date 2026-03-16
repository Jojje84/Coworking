// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export type UserRole = "user" | "admin";

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
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
