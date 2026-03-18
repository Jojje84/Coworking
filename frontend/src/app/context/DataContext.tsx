// ─────────────────────────────────────────
// Data Context
// ─────────────────────────────────────────

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
  useCallback,
} from "react";
import {
  Room,
  Booking,
  User,
  CalendarBooking,
  UserPermissions,
} from "../types";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import { io, Socket } from "socket.io-client";

interface DataContextType {
  rooms: Room[];
  bookings: Booking[];
  calendarBookings: CalendarBooking[];
  users: User[];
  newBookingIds: string[];
  adminAnnouncement: string;
  userAnnouncement: string;

  loadCalendarBookings: (start: string, end: string) => Promise<void>;

  addRoom: (room: Omit<Room, "id">) => Promise<boolean>;
  updateRoom: (id: string, room: Partial<Room>) => Promise<boolean>;
  deleteRoom: (id: string) => Promise<boolean>;

  addBooking: (
    booking: Omit<Booking, "id" | "createdAt" | "status">,
  ) => Promise<boolean>;
  updateBooking: (id: string, booking: Partial<Booking>) => Promise<boolean>;
  cancelBooking: (id: string) => Promise<boolean>;
  deleteBooking: (id: string) => Promise<boolean>;
  hardDeleteBooking: (id: string, confirmText: string) => Promise<boolean>;

  addUser: (user: {
    username: string;
    email: string;
    password: string;
    role: "user" | "admin";
    permissions?: UserPermissions;
  }) => Promise<boolean>;
  updateUser: (
    id: string,
    user: {
      username?: string;
      email?: string;
      password?: string;
      role?: "user" | "admin";
      permissions?: UserPermissions;
    },
  ) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;
  restoreUser: (id: string) => Promise<boolean>;
  hardDeleteUser: (id: string, confirmText: string) => Promise<boolean>;

  isRoomAvailable: (
    roomId: string,
    startTime: string,
    endTime: string,
    excludeBookingId?: string,
  ) => boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

const mapRoomTypeFromApi = (t: string) => t;
const mapRoomTypeToApi = (t: string) => t;

function authHeaders(token: string | null): HeadersInit {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function normalizeId(value: any): string {
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

function mapBookingFromApi(b: any): Booking {
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

function mapCalendarBookingFromApi(b: any): CalendarBooking {
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

function mapUserFromApi(u: any): User {
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

// ─────────────────────────────────────────
// DataProvider
// ─────────────────────────────────────────

export function DataProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [calendarBookings, setCalendarBookings] = useState<CalendarBooking[]>(
    [],
  );
  const [users, setUsers] = useState<User[]>([]);
  const [newBookingIds, setNewBookingIds] = useState<string[]>([]);
  const [adminAnnouncement, setAdminAnnouncement] = useState("");
  const [userAnnouncement, setUserAnnouncement] = useState("");
  const calendarRangeRef = useRef<{ start: string; end: string } | null>(null);

  const loadCalendarBookings = useCallback(
    async (start: string, end: string): Promise<void> => {
      if (!token) return;

      calendarRangeRef.current = { start, end };

      try {
        const params = new URLSearchParams({ start, end });
        const res = await fetch(
          `${API_BASE_URL}/api/bookings/calendar?${params.toString()}`,
          {
            headers: { ...authHeaders(token) },
          },
        );

        if (!res.ok) {
          throw new Error(`Failed to load calendar bookings: ${res.status}`);
        }

        const data = await res.json();
        const mapped: CalendarBooking[] = data.map(mapCalendarBookingFromApi);
        setCalendarBookings(mapped);
      } catch (err) {
        console.error("loadCalendarBookings error:", err);
        toast.error("Could not load calendar bookings");
      }
    },
    [token],
  );

  // ─────────────────────────────────────────
  // Load Settings Announcements
  // ─────────────────────────────────────────

  useEffect(() => {
    if (!token || !user) {
      setAdminAnnouncement("");
      setUserAnnouncement("");
      return;
    }

    async function loadAnnouncements() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/settings`, {
          headers: { ...authHeaders(token) },
        });

        if (!res.ok) {
          setAdminAnnouncement("");
          setUserAnnouncement("");
          return;
        }

        const data = await res.json().catch(() => null);
        setAdminAnnouncement(String(data?.adminAnnouncement || "").trim());
        setUserAnnouncement(String(data?.userAnnouncement || "").trim());
      } catch (err) {
        console.error("loadAnnouncements error:", err);
        setAdminAnnouncement("");
        setUserAnnouncement("");
      }
    }

    loadAnnouncements();
  }, [token, user?.id, user?.role]);

  // ─────────────────────────────────────────
  // Load Rooms
  // ─────────────────────────────────────────

  useEffect(() => {
    if (!token) {
      setRooms([]);
      return;
    }

    async function loadRooms() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/rooms`, {
          headers: { ...authHeaders(token) },
        });
        if (!res.ok) throw new Error(`Failed to load rooms: ${res.status}`);
        const data = await res.json();

        const mapped: Room[] = data.map((r: any) => ({
          id: r._id ?? r.id,
          name: r.name,
          capacity: r.capacity,
          type: mapRoomTypeFromApi(r.type) as Room["type"],
          description: r.description ?? "",
          imageUrl: r.imageUrl ?? "",
        }));

        setRooms(mapped);
      } catch (err) {
        console.error("loadRooms error:", err);
        toast.error("Kunde inte hämta rum från servern");
      }
    }

    loadRooms();
  }, [token]);

  // ─────────────────────────────────────────
  // Load Bookings
  // ─────────────────────────────────────────

  useEffect(() => {
    if (!token) {
      setBookings([]);
      setNewBookingIds([]);
      return;
    }

    async function loadBookings() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/bookings`, {
          headers: { ...authHeaders(token) },
        });
        if (!res.ok) throw new Error(`Failed to load bookings: ${res.status}`);

        const data = await res.json();
        const mapped: Booking[] = data.map(mapBookingFromApi);
        setBookings(mapped);
      } catch (err) {
        console.error("loadBookings error:", err);
        toast.error("Could not load bookings");
      }
    }

    loadBookings();
  }, [token]);

  // ─────────────────────────────────────────
  // Load Users (Admin only)
  // ─────────────────────────────────────────

  useEffect(() => {
    if (!token) {
      setUsers([]);
      return;
    }

    if (user?.role !== "admin") {
      setUsers([]);
      return;
    }

    async function loadUsers() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/users?includeDeleted=true`, {
          headers: { ...authHeaders(token) },
        });

        if (res.status === 403) {
          setUsers([]);
          return;
        }

        if (!res.ok) throw new Error(`Failed to load users: ${res.status}`);

        const data = await res.json();
        const mapped: User[] = data.map(mapUserFromApi);
        setUsers(mapped);
      } catch (err) {
        console.error("loadUsers error:", err);
        setUsers([]);
      }
    }

    loadUsers();
  }, [token, user?.role]);

  // ─────────────────────────────────────────
  // Socket.IO — Real-time Events
  // ─────────────────────────────────────────

  useEffect(() => {
    if (!token) return;

    const socket: Socket = io(API_BASE_URL, {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket connect error:", err.message);
    });

    socket.on("booking:created", (payload: any) => {
      const mapped = mapBookingFromApi(payload);

      setBookings((prev) => {
        const exists = prev.some((b) => b.id === mapped.id);
        if (exists) return prev;
        return [mapped, ...prev];
      });

      setNewBookingIds((prev) => {
        if (prev.includes(mapped.id)) return prev;
        return [mapped.id, ...prev];
      });

      setTimeout(() => {
        setNewBookingIds((prev) => prev.filter((id) => id !== mapped.id));
      }, 15000);

      toast.info("A booking was created");
    });

    socket.on("booking:updated", (payload: any) => {
      const mapped = mapBookingFromApi(payload);

      setBookings((prev) => {
        const exists = prev.some((b) => b.id === mapped.id);
        if (!exists) return [mapped, ...prev];
        return prev.map((b) => (b.id === mapped.id ? mapped : b));
      });
    });

    socket.on("booking:deleted", (payload: any) => {
      const deletedIdRaw = payload?.id ?? payload?._id;
      const deletedId = normalizeId(deletedIdRaw);
      if (!deletedId) return;

      setBookings((prev) => prev.filter((b) => b.id !== deletedId));
      setNewBookingIds((prev) => prev.filter((id) => id !== deletedId));
    });

    socket.on("calendar:changed", () => {
      const range = calendarRangeRef.current;
      if (!range) return;

      loadCalendarBookings(range.start, range.end);
    });

    socket.on("room:created", (payload: any) => {
      const mapped: Room = {
        id: payload._id ?? payload.id,
        name: payload.name,
        capacity: payload.capacity,
        type: mapRoomTypeFromApi(payload.type) as Room["type"],
        description: payload.description ?? "",
        imageUrl: payload.imageUrl ?? "",
      };

      setRooms((prev) => {
        const exists = prev.some((r) => r.id === mapped.id);
        if (exists) return prev;
        return [mapped, ...prev];
      });
    });

    socket.on("room:updated", (payload: any) => {
      const mapped: Room = {
        id: payload._id ?? payload.id,
        name: payload.name,
        capacity: payload.capacity,
        type: mapRoomTypeFromApi(payload.type) as Room["type"],
        description: payload.description ?? "",
        imageUrl: payload.imageUrl ?? "",
      };

      setRooms((prev) => prev.map((r) => (r.id === mapped.id ? mapped : r)));
    });

    socket.on("room:deleted", (payload: any) => {
      const deletedId = payload?.id ?? payload?._id;
      if (!deletedId) return;

      setRooms((prev) => prev.filter((r) => r.id !== deletedId));
    });

    socket.on("user:created", (payload: any) => {
      const mapped = mapUserFromApi(payload);

      setUsers((prev) => {
        const exists = prev.some((u) => u.id === mapped.id);
        if (exists) return prev;
        return [mapped, ...prev];
      });

      if (user?.role === "admin") {
        toast.info(`New user registered: ${mapped.username}`);
      }
    });

    socket.on("user:updated", (payload: any) => {
      const mapped = mapUserFromApi(payload);

      setUsers((prev) => {
        const exists = prev.some((u) => u.id === mapped.id);
        if (!exists) return [mapped, ...prev];
        return prev.map((u) => (u.id === mapped.id ? mapped : u));
      });
    });

    socket.on("user:deleted", (payload: any) => {
      const deletedId = payload?.id ?? payload?._id;
      if (!deletedId) return;

      const isSoftDelete = Boolean(payload?.soft);

      if (isSoftDelete) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === deletedId
              ? {
                  ...u,
                  isDeleted: true,
                  deletedAt: new Date().toISOString(),
                  deleteAfter: payload?.deleteAfter
                    ? new Date(payload.deleteAfter).toISOString()
                    : u.deleteAfter ?? null,
                }
              : u,
          ),
        );
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== deletedId));
    });

    socket.on("user:restored", (payload: any) => {
      const mapped = mapUserFromApi(payload);

      setUsers((prev) => {
        const exists = prev.some((u) => u.id === mapped.id);
        if (!exists) return [mapped, ...prev];
        return prev.map((u) => (u.id === mapped.id ? mapped : u));
      });
    });

    socket.on("settings:updated", (payload: any) => {
      setAdminAnnouncement(String(payload?.adminAnnouncement || "").trim());
      setUserAnnouncement(String(payload?.userAnnouncement || "").trim());
    });

    return () => {
      socket.disconnect();
    };
  }, [token, user, loadCalendarBookings]);

  // ─────────────────────────────────────────
  // Room Actions
  // ─────────────────────────────────────────

  const addRoom = async (room: Omit<Room, "id">): Promise<boolean> => {
    if (!token) return false;

    try {
      const res = await fetch(`${API_BASE_URL}/api/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token),
        },
        body: JSON.stringify({
          name: room.name.trim(),
          capacity: room.capacity,
          type: mapRoomTypeToApi(room.type),
          description: room.description,
          imageUrl: room.imageUrl,
        }),
      });

      if (res.status === 403) {
        toast.error("Endast admin kan skapa rum");
        return false;
      }

      if (res.status === 400) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Invalid room data");
        return false;
      }

      if (!res.ok) {
        throw new Error(`Failed to create room: ${res.status}`);
      }

      const created = await res.json();
      const mapped: Room = {
        id: created._id ?? created.id,
        name: created.name,
        capacity: created.capacity,
        type: mapRoomTypeFromApi(created.type) as Room["type"],
        description: created.description ?? "",
        imageUrl: created.imageUrl ?? "",
      };

      setRooms((prev) => [mapped, ...prev]);
      toast.success(`Room "${mapped.name}" has been added`);
      return true;
    } catch (err) {
      console.error("addRoom error:", err);
      toast.error("Could not create room");
      return false;
    }
  };

  const updateRoom = async (
    id: string,
    room: Partial<Room>,
  ): Promise<boolean> => {
    if (!token) return false;

    try {
      const body: Record<string, unknown> = {};

      if (room.name !== undefined) body.name = room.name.trim();
      if (room.capacity !== undefined) body.capacity = room.capacity;
      if (room.type !== undefined) body.type = mapRoomTypeToApi(room.type);
      if (room.description !== undefined) body.description = room.description;
      if (room.imageUrl !== undefined) body.imageUrl = room.imageUrl;

      const res = await fetch(`${API_BASE_URL}/api/rooms/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token),
        },
        body: JSON.stringify(body),
      });

      if (res.status === 403) {
        toast.error("Endast admin kan uppdatera rum");
        return false;
      }

      if (res.status === 404) {
        toast.error("Room not found");
        return false;
      }

      if (res.status === 400) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Invalid room data");
        return false;
      }

      if (!res.ok) {
        throw new Error(`Failed to update room: ${res.status}`);
      }

      const saved = await res.json();
      const mapped: Room = {
        id: saved._id ?? saved.id,
        name: saved.name,
        capacity: saved.capacity,
        type: mapRoomTypeFromApi(saved.type) as Room["type"],
        description: saved.description ?? "",
        imageUrl: saved.imageUrl ?? "",
      };

      setRooms((prev) => prev.map((r) => (r.id === id ? mapped : r)));
      toast.success(`Room "${mapped.name}" has been updated`);
      return true;
    } catch (err) {
      console.error("updateRoom error:", err);
      toast.error("Could not update room");
      return false;
    }
  };

  const deleteRoom = async (id: string): Promise<boolean> => {
    if (!token) return false;

    try {
      const res = await fetch(`${API_BASE_URL}/api/rooms/${id}`, {
        method: "DELETE",
        headers: { ...authHeaders(token) },
      });

      if (res.status === 403) {
        toast.error("Endast admin kan ta bort rum");
        return false;
      }

      if (res.status === 404) {
        toast.error("Room not found");
        return false;
      }

      if (!res.ok) throw new Error(`Failed to delete room: ${res.status}`);

      setRooms((prev) => prev.filter((r) => r.id !== id));
      toast.success("Room has been deleted");
      return true;
    } catch (err) {
      console.error("deleteRoom error:", err);
      toast.error("Could not delete room");
      return false;
    }
  };

  // ─────────────────────────────────────────
  // Booking Actions
  // ─────────────────────────────────────────

  const addBooking = async (
    booking: Omit<Booking, "id" | "createdAt" | "status">,
  ): Promise<boolean> => {
    if (!token) return false;

    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token),
        },
        body: JSON.stringify({
          roomId: booking.roomId,
          startTime: booking.startTime,
          endTime: booking.endTime,
        }),
      });

      if (res.status === 409) {
        toast.error("Room is already booked for the selected time");
        return false;
      }

      if (res.status === 400) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Invalid booking data");
        return false;
      }

      if (!res.ok) throw new Error(`Failed to create booking: ${res.status}`);

      const created = await res.json();
      const mapped = mapBookingFromApi(created);

      setBookings((prev) => {
        const exists = prev.some((b) => b.id === mapped.id);
        if (exists) return prev;
        return [mapped, ...prev];
      });
      toast.success("Booking has been created");
      return true;
    } catch (err) {
      console.error("addBooking error:", err);
      toast.error("Could not create booking");
      return false;
    }
  };

  const updateBooking = async (
    id: string,
    updatedBooking: Partial<Booking>,
  ): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token),
        },
        body: JSON.stringify({
          ...(updatedBooking.roomId !== undefined
            ? { roomId: updatedBooking.roomId }
            : {}),
          ...(updatedBooking.startTime !== undefined
            ? { startTime: updatedBooking.startTime }
            : {}),
          ...(updatedBooking.endTime !== undefined
            ? { endTime: updatedBooking.endTime }
            : {}),
          ...(updatedBooking.status !== undefined
            ? { status: updatedBooking.status }
            : {}),
        }),
      });

      if (res.status === 403) {
        toast.error(
          "Du får bara ändra dina egna bokningar (om du inte är admin)",
        );
        return false;
      }
      if (res.status === 409) {
        toast.error("Room is already booked for the selected time");
        return false;
      }
      if (!res.ok) throw new Error(`Failed to update booking: ${res.status}`);

      const saved = await res.json();
      const savedMapped = mapBookingFromApi(saved);

      setBookings((prev) => prev.map((b) => (b.id === id ? savedMapped : b)));
      toast.success("Booking has been updated");
      return true;
    } catch (err) {
      console.error("updateBooking error:", err);
      toast.error("Could not update booking");
      return false;
    }
  };

  const cancelBooking = async (id: string): Promise<boolean> => {
    return updateBooking(id, { status: "cancelled" });
  };

  const deleteBooking = async (id: string): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${id}`, {
        method: "DELETE",
        headers: { ...authHeaders(token) },
      });

      if (res.status === 403) {
        const data = await res.json().catch(() => null);
        toast.error(
          data?.message || "Only the booking owner or an admin can cancel it",
        );
        return false;
      }
      if (res.status === 400) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Booking cannot be cancelled");
        return false;
      }
      if (!res.ok) throw new Error(`Failed to delete booking: ${res.status}`);

      const saved = await res.json();
      const mapped = mapBookingFromApi(saved);

      setBookings((prev) => {
        const exists = prev.some((b) => b.id === mapped.id);
        if (!exists) return [mapped, ...prev];
        return prev.map((b) => (b.id === mapped.id ? mapped : b));
      });
      toast.success("Booking has been cancelled");
      return true;
    } catch (err) {
      console.error("deleteBooking error:", err);
      toast.error("Could not cancel booking");
      return false;
    }
  };

  const hardDeleteBooking = async (
    id: string,
    confirmText: string,
  ): Promise<boolean> => {
    if (!token) return false;

    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings/${id}/hard`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token),
        },
        body: JSON.stringify({ confirmText }),
      });

      if (res.status === 403) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Endast admin kan radera permanent");
        return false;
      }

      if (res.status === 400) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Booking can not be hard deleted");
        return false;
      }

      if (res.status === 404) {
        toast.error("Booking not found");
        return false;
      }

      if (!res.ok) {
        throw new Error(`Failed to hard delete booking: ${res.status}`);
      }

      setBookings((prev) => prev.filter((b) => b.id !== id));
      toast.success("Booking permanently deleted");
      return true;
    } catch (err) {
      console.error("hardDeleteBooking error:", err);
      toast.error("Could not hard delete booking");
      return false;
    }
  };

  // ─────────────────────────────────────────
  // User Actions (Admin)
  // ─────────────────────────────────────────

  const addUser = async (newUser: {
    username: string;
    email: string;
    password: string;
    role: "user" | "admin";
    permissions?: UserPermissions;
  }): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/api/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token),
        },
        body: JSON.stringify({
          username: newUser.username.trim(),
          email: newUser.email.trim().toLowerCase(),
          password: newUser.password,
          role: newUser.role === "admin" ? "Admin" : "User",
          permissions:
            newUser.role === "admin"
              ? {
                  bookingHardDelete: Boolean(
                    newUser.permissions?.bookingHardDelete,
                  ),
                  userHardDelete: Boolean(newUser.permissions?.userHardDelete),
                  manageAdmins: Boolean(newUser.permissions?.manageAdmins),
                  manageSettings: Boolean(newUser.permissions?.manageSettings),
                  viewAuditLogs: Boolean(newUser.permissions?.viewAuditLogs),
                }
              : undefined,
        }),
      });

      if (res.status === 400) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Invalid user data");
        return false;
      }

      if (res.status === 403) {
        toast.error("Endast admin kan skapa användare");
        return false;
      }

      if (res.status === 409) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Username or email already exists");
        return false;
      }

      if (!res.ok) {
        throw new Error(`Failed to create user: ${res.status}`);
      }

      const created = await res.json();
      const mapped = mapUserFromApi(created);

      setUsers((prev) => {
        const exists = prev.some((u) => u.id === mapped.id);
        if (exists) return prev;
        return [mapped, ...prev];
      });

      toast.success(`User "${mapped.username}" has been added`);
      return true;
    } catch (err) {
      console.error("addUser error:", err);
      toast.error("Could not create user");
      return false;
    }
  };

  const updateUser = async (
    id: string,
    updatedUser: {
      username?: string;
      email?: string;
      password?: string;
      role?: "user" | "admin";
      permissions?: UserPermissions;
    },
  ): Promise<boolean> => {
    if (!token) return false;

    try {
      const body: Record<string, unknown> = {};

      if (updatedUser.username !== undefined) {
        body.username = updatedUser.username.trim();
      }

      if (updatedUser.email !== undefined) {
        body.email = updatedUser.email.trim().toLowerCase();
      }

      if (updatedUser.password !== undefined && updatedUser.password !== "") {
        body.password = updatedUser.password;
      }

      if (updatedUser.role !== undefined) {
        body.role = updatedUser.role === "admin" ? "Admin" : "User";
      }

      if (updatedUser.permissions !== undefined) {
        body.permissions = {
          bookingHardDelete: Boolean(updatedUser.permissions.bookingHardDelete),
          userHardDelete: Boolean(updatedUser.permissions.userHardDelete),
          manageAdmins: Boolean(updatedUser.permissions.manageAdmins),
          manageSettings: Boolean(updatedUser.permissions.manageSettings),
          viewAuditLogs: Boolean(updatedUser.permissions.viewAuditLogs),
        };
      }

      const res = await fetch(`${API_BASE_URL}/api/users/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token),
        },
        body: JSON.stringify(body),
      });

      if (res.status === 403) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Endast admin kan uppdatera användare");
        return false;
      }

      if (res.status === 404) {
        toast.error("User not found");
        return false;
      }

      if (res.status === 409) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Username or email already exists");
        return false;
      }

      if (res.status === 400) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Invalid user data");
        return false;
      }

      if (!res.ok) {
        throw new Error(`Failed to update user: ${res.status}`);
      }

      const saved = await res.json();
      const mapped = mapUserFromApi(saved);

      setUsers((prev) => prev.map((u) => (u.id === id ? mapped : u)));
      toast.success(`User "${mapped.username}" has been updated`);
      return true;
    } catch (err) {
      console.error("updateUser error:", err);
      toast.error("Could not update user");
      return false;
    }
  };

  const deleteUser = async (id: string): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${id}`, {
        method: "DELETE",
        headers: { ...authHeaders(token) },
      });

      if (res.status === 404) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Users API saknas i backend ännu");
        return false;
      }

      if (res.status === 403) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Endast admin kan ta bort användare");
        return false;
      }

      if (!res.ok) throw new Error(`Failed to delete user: ${res.status}`);

      const data = await res.json().catch(() => null);

      setUsers((prev) =>
        prev.map((u) =>
          u.id === id
            ? {
                ...u,
                isDeleted: true,
                deletedAt: new Date().toISOString(),
                deleteAfter: data?.deleteAfter
                  ? new Date(data.deleteAfter).toISOString()
                  : u.deleteAfter ?? null,
              }
            : u,
        ),
      );

      toast.success("User soft deleted");
      return true;
    } catch (err) {
      console.error("deleteUser error:", err);
      toast.error("Could not delete user");
      return false;
    }
  };

  const restoreUser = async (id: string): Promise<boolean> => {
    if (!token) return false;

    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${id}/restore`, {
        method: "POST",
        headers: { ...authHeaders(token) },
      });

      if (res.status === 404) {
        toast.error("User not found");
        return false;
      }

      if (res.status === 410) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Grace period has expired");
        return false;
      }

      if (res.status === 403) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Endast admin kan återställa användare");
        return false;
      }

      if (!res.ok) throw new Error(`Failed to restore user: ${res.status}`);

      const restored = await res.json();
      const mapped = mapUserFromApi(restored);

      setUsers((prev) => {
        const exists = prev.some((u) => u.id === mapped.id);
        if (!exists) return [mapped, ...prev];
        return prev.map((u) => (u.id === mapped.id ? mapped : u));
      });

      toast.success(`User "${mapped.username}" has been restored`);
      return true;
    } catch (err) {
      console.error("restoreUser error:", err);
      toast.error("Could not restore user");
      return false;
    }
  };

  const hardDeleteUser = async (
    id: string,
    confirmText: string,
  ): Promise<boolean> => {
    if (!token) return false;

    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${id}/hard`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token),
        },
        body: JSON.stringify({ confirmText }),
      });

      if (res.status === 403) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "userHardDelete permission required");
        return false;
      }

      if (res.status === 400) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Could not permanently delete user");
        return false;
      }

      if (res.status === 404) {
        toast.error("User not found");
        return false;
      }

      if (!res.ok) throw new Error(`Failed to hard delete user: ${res.status}`);

      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success("User permanently deleted");
      return true;
    } catch (err) {
      console.error("hardDeleteUser error:", err);
      toast.error("Could not permanently delete user");
      return false;
    }
  };

  // ─────────────────────────────────────────
  // Availability Check
  // ─────────────────────────────────────────

  const isRoomAvailable = useCallback(
    (
      roomId: string,
      startTime: string,
      endTime: string,
      excludeBookingId?: string,
    ) => {
      const requestedStart = new Date(startTime).getTime();
      const requestedEnd = new Date(endTime).getTime();

      return !bookings.some((booking) => {
        if (booking.roomId !== roomId) return false;
        if (booking.status === "cancelled") return false;
        if (excludeBookingId && booking.id === excludeBookingId) return false;

        const bookingStart = new Date(booking.startTime).getTime();
        const bookingEnd = new Date(booking.endTime).getTime();

        return requestedStart < bookingEnd && requestedEnd > bookingStart;
      });
    },
    [bookings],
  );

  const value = useMemo(
    () => ({
      rooms,
      bookings,
      calendarBookings,
      users,
      newBookingIds,
      adminAnnouncement,
      userAnnouncement,
      loadCalendarBookings,
      addRoom,
      updateRoom,
      deleteRoom,
      addBooking,
      updateBooking,
      cancelBooking,
      deleteBooking,
      hardDeleteBooking,
      addUser,
      updateUser,
      deleteUser,
      restoreUser,
      hardDeleteUser,
      isRoomAvailable,
    }),
    [
      rooms,
      bookings,
      calendarBookings,
      users,
      newBookingIds,
      adminAnnouncement,
      userAnnouncement,
      loadCalendarBookings,
      isRoomAvailable,
      hardDeleteBooking,
      restoreUser,
      hardDeleteUser,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// ─────────────────────────────────────────
// useData Hook
// ─────────────────────────────────────────

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
