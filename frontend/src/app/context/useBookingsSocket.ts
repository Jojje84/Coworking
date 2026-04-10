import { useEffect } from "react";
import { Socket } from "socket.io-client";
import { mapBookingFromApi, normalizeId } from "./dataShared";
import { Booking } from "../types";

type SocketHandlers = {
  onBookingCreated: (booking: Booking) => void;
  onBookingUpdated: (booking: Booking) => void;
  onBookingDeleted: (id: string) => void;
  onCalendarChanged: () => void;
};

/**
 * Hook to manage booking socket.io events
 * Handles all real-time updates for bookings and calendar
 */
export function useBookingsSocket(
  socket: Socket | null,
  handlers: SocketHandlers,
) {
  useEffect(() => {
    if (!socket) return;

    const handleBookingCreated = (payload: any) => {
      const mapped = mapBookingFromApi(payload);
      handlers.onBookingCreated(mapped);
    };

    const handleBookingUpdated = (payload: any) => {
      const mapped = mapBookingFromApi(payload);
      handlers.onBookingUpdated(mapped);
    };

    const handleBookingDeleted = (payload: any) => {
      const deletedIdRaw = payload?.id ?? payload?._id;
      const deletedId = normalizeId(deletedIdRaw);
      if (deletedId) {
        handlers.onBookingDeleted(deletedId);
      }
    };

    const handleCalendarChanged = () => {
      handlers.onCalendarChanged();
    };

    socket.on("booking:created", handleBookingCreated);
    socket.on("booking:updated", handleBookingUpdated);
    socket.on("booking:deleted", handleBookingDeleted);
    socket.on("calendar:changed", handleCalendarChanged);

    return () => {
      socket.off("booking:created", handleBookingCreated);
      socket.off("booking:updated", handleBookingUpdated);
      socket.off("booking:deleted", handleBookingDeleted);
      socket.off("calendar:changed", handleCalendarChanged);
    };
  }, [socket, handlers]);
}
