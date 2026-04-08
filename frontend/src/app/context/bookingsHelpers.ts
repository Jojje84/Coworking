import { Booking, CalendarBooking } from "../types";

/**
 * Manage new booking badge logic with timeout
 */
export function handleNewBookingBadge(
  bookingId: string,
  setNewBookingIds: React.Dispatch<React.SetStateAction<string[]>>,
) {
  // Add badge
  setNewBookingIds((prev) => {
    if (prev.includes(bookingId)) return prev;
    return [bookingId, ...prev];
  });

  // Remove badge after 15 seconds
  const timeout = setTimeout(() => {
    setNewBookingIds((prev) => prev.filter((id) => id !== bookingId));
  }, 15000);

  return () => clearTimeout(timeout);
}

/**
 * Update or prepend booking to list
 */
export function updateOrPrependBooking(
  booking: Booking,
  bookings: Booking[],
): Booking[] {
  const exists = bookings.some((b) => b.id === booking.id);
  if (exists) {
    return bookings.map((b) => (b.id === booking.id ? booking : b));
  }
  return [booking, ...bookings];
}

/**
 * Remove booking from list
 */
export function removeBookingFromList(
  bookingId: string,
  bookings: Booking[],
): Booking[] {
  return bookings.filter((b) => b.id !== bookingId);
}

/**
 * Room availability check using calendar bookings
 */
export function isRoomAvailable(
  roomId: string,
  startTime: string,
  endTime: string,
  calendarBookings: CalendarBooking[],
  excludeBookingId?: string,
): boolean {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();

  return !calendarBookings.some((booking) => {
    if (booking.roomId !== roomId) return false;
    if (excludeBookingId && booking.id === excludeBookingId) return false;

    const bookingStart = new Date(booking.startTime).getTime();
    const bookingEnd = new Date(booking.endTime).getTime();

    // Check for overlap
    return start < bookingEnd && end > bookingStart;
  });
}
