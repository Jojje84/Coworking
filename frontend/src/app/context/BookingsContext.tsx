import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import { Booking, CalendarBooking } from "../types";
import { mapBookingFromApi, mapCalendarBookingFromApi } from "./dataShared";
import { useBookingsSocket } from "./useBookingsSocket";
import { logger } from "../../utils/logger";
import {
  handleNewBookingBadge,
  updateOrPrependBooking,
  removeBookingFromList,
  isRoomAvailable as checkRoomAvailable,
} from "./bookingsHelpers";
import {
  createBookingApi,
  deleteBookingApi,
  getBookingsApi,
  getCalendarBookingsApi,
  hardDeleteBookingApi,
  updateBookingApi,
} from "../../api/bookingsApi";

type BookingsContextType = {
  bookings: Booking[];
  calendarBookings: CalendarBooking[];
  newBookingIds: string[];
  loadCalendarBookings: (start: string, end: string) => Promise<void>;
  addBooking: (
    booking: Omit<Booking, "id" | "createdAt" | "status">,
  ) => Promise<boolean>;
  updateBooking: (id: string, booking: Partial<Booking>) => Promise<boolean>;
  cancelBooking: (id: string) => Promise<boolean>;
  deleteBooking: (id: string) => Promise<boolean>;
  hardDeleteBooking: (id: string, confirmText: string) => Promise<boolean>;
  isRoomAvailable: (
    roomId: string,
    startTime: string,
    endTime: string,
    excludeBookingId?: string,
  ) => boolean;
};

const BookingsContext = createContext<BookingsContextType | undefined>(
  undefined,
);

export function BookingsProvider({ children }: { children: ReactNode }) {
  const { token, socket, user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [calendarBookings, setCalendarBookings] = useState<CalendarBooking[]>(
    [],
  );
  const [newBookingIds, setNewBookingIds] = useState<string[]>([]);
  const calendarRangeRef = useRef<{ start: string; end: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setBookings([]);
      setNewBookingIds([]);
      return;
    }

    async function loadBookings() {
      try {
        const res = await getBookingsApi(token);
        if (!res.ok) throw new Error(`Failed to load bookings: ${res.status}`);

        const data = await res.json();
        setBookings(data.map(mapBookingFromApi));
      } catch (err) {
        logger.error("loadBookings error:", err);
        toast.error("Could not load bookings");
      }
    }

    loadBookings();
  }, [token]);

  const loadCalendarBookings = useCallback(
    async (start: string, end: string): Promise<void> => {
      if (!token) return;

      calendarRangeRef.current = { start, end };

      try {
        const res = await getCalendarBookingsApi(token, start, end);

        if (!res.ok) {
          throw new Error(`Failed to load calendar bookings: ${res.status}`);
        }

        const data = await res.json();
        setCalendarBookings(data.map(mapCalendarBookingFromApi));
      } catch (err) {
        logger.error("loadCalendarBookings error:", err);
        toast.error("Could not load calendar bookings");
      }
    },
    [token],
  );

  // Set up socket event handlers
  const socketHandlers = useMemo(
    () => ({
      onBookingCreated: (mapped: Booking) => {
        setBookings((prev) => updateOrPrependBooking(mapped, prev));
        handleNewBookingBadge(mapped.id, setNewBookingIds);

        if (mapped.userId !== user?.id) {
          toast.info("A booking was created");
        }
      },
      onBookingUpdated: (mapped: Booking) => {
        setBookings((prev) => {
          const exists = prev.some((b) => b.id === mapped.id);
          if (!exists) return [mapped, ...prev];
          return prev.map((b) => (b.id === mapped.id ? mapped : b));
        });
      },
      onBookingDeleted: (deletedId: string) => {
        setBookings((prev) => removeBookingFromList(deletedId, prev));
        setNewBookingIds((prev) => prev.filter((id) => id !== deletedId));
      },
      onCalendarChanged: () => {
        const range = calendarRangeRef.current;
        if (!range) return;
        loadCalendarBookings(range.start, range.end);
      },
    }),
    [loadCalendarBookings, user?.id],
  );

  // Use the socket hook with handlers
  useBookingsSocket(socket, socketHandlers);

  const addBooking = async (
    booking: Omit<Booking, "id" | "createdAt" | "status">,
  ): Promise<boolean> => {
    if (!token) return false;

    try {
      const res = await createBookingApi(token, {
        roomId: booking.roomId,
        startTime: booking.startTime,
        endTime: booking.endTime,
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

      setBookings((prev) => updateOrPrependBooking(mapped, prev));
      toast.success("Booking has been created");
      return true;
    } catch (err) {
      logger.error("addBooking error:", err);
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
      const res = await updateBookingApi(token, id, {
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
      });

      if (res.status === 403) {
        toast.error(
          "You can only edit your own bookings unless you are an admin",
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
      logger.error("updateBooking error:", err);
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
      const res = await deleteBookingApi(token, id);

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
      logger.error("deleteBooking error:", err);
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
      const res = await hardDeleteBookingApi(token, id, confirmText);

      if (res.status === 403) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Only admins can delete permanently");
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

      setBookings((prev) => removeBookingFromList(id, prev));
      toast.success("Booking permanently deleted");
      return true;
    } catch (err) {
      logger.error("hardDeleteBooking error:", err);
      toast.error("Could not hard delete booking");
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
      return checkRoomAvailable(
        roomId,
        startTime,
        endTime,
        calendarBookings,
        excludeBookingId,
      );
    },
    [calendarBookings],
  );

  const value = {
    bookings,
    calendarBookings,
    newBookingIds,
    loadCalendarBookings,
    addBooking,
    updateBooking,
    cancelBooking,
    deleteBooking,
    hardDeleteBooking,
    isRoomAvailable,
  };

  return (
    <BookingsContext.Provider value={value}>
      {children}
    </BookingsContext.Provider>
  );
}

export function useBookings() {
  const context = useContext(BookingsContext);
  if (!context) {
    throw new Error("useBookings must be used within a BookingsProvider");
  }
  return context;
}
