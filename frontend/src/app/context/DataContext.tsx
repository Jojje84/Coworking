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
import { Room, Booking, User, CalendarBooking } from "../types";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import { io, Socket } from "socket.io-client";

interface DataContextType {
  rooms: Room[];
  bookings: Booking[];
  calendarBookings: CalendarBooking[];
  users: User[];
  newBookingIds: string[];

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

  addUser: (user: {
    username: string;
    email: string;
    password: string;
    role: "user" | "admin";
  }) => Promise<boolean>;
  updateUser: (
    id: string,
    user: {
      username?: string;
      email?: string;
      password?: string;
      role?: "user" | "admin";
    },
  ) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;

  isRoomAvailable: (
    roomId: string,
    startTime: string,
    endTime: string,
    excludeBookingId?: string,
  ) => boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

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
    createdAt: u.createdAt
      ? new Date(u.createdAt).toISOString()
      : new Date().toISOString(),
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [calendarBookings, setCalendarBookings] = useState<CalendarBooking[]>(
    [],
  );
  const [users, setUsers] = useState<User[]>([]);
  const [newBookingIds, setNewBookingIds] = useState<string[]>([]);
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

  useEffect(() => {
    if (!token) {
      setUsers([]);
      return;
    }

    async function loadUsers() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/users`, {
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
  }, [token]);

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

      setUsers((prev) => prev.filter((u) => u.id !== deletedId));
    });

    return () => {
      socket.disconnect();
    };
  }, [token, user, loadCalendarBookings]);

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
        method: "PATCH",
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
          data?.message || "Only the booking owner or an admin can delete it",
        );
        return false;
      }
      if (!res.ok) throw new Error(`Failed to delete booking: ${res.status}`);

      setBookings((prev) => prev.filter((b) => b.id !== id));
      toast.success("Booking has been deleted");
      return true;
    } catch (err) {
      console.error("deleteBooking error:", err);
      toast.error("Could not delete booking");
      return false;
    }
  };

  const addUser = async (newUser: {
    username: string;
    email: string;
    password: string;
    role: "user" | "admin";
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
    },
  ): Promise<boolean> => {
    if (!token) return false;

    try {
      const body: Record<string, string> = {};

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

      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success("User has been deleted");
      return true;
    } catch (err) {
      console.error("deleteUser error:", err);
      toast.error("Could not delete user");
      return false;
    }
  };

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
      loadCalendarBookings,
      addRoom,
      updateRoom,
      deleteRoom,
      addBooking,
      updateBooking,
      cancelBooking,
      deleteBooking,
      addUser,
      updateUser,
      deleteUser,
      isRoomAvailable,
    }),
    [
      rooms,
      bookings,
      calendarBookings,
      users,
      newBookingIds,
      loadCalendarBookings,
      isRoomAvailable,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}