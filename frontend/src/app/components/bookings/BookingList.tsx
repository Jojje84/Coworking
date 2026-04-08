import { DoorOpen } from "lucide-react";
import { Booking, Room } from "../../types";
import { BookingCard } from "./BookingCard";

type BookingListProps = {
  title: string;
  bookings: Booking[];
  rooms: Room[];
  newBookingIds?: string[];
  onEdit?: (bookingId: string) => void;
  onCancel?: (bookingId: string) => void;
  emptyTitle: string;
  emptyDescription: string;
};

export function BookingList({
  title,
  bookings,
  rooms,
  newBookingIds = [],
  onEdit,
  onCancel,
  emptyTitle,
  emptyDescription,
}: BookingListProps) {
  return (
    <div>
      <h2 className="mb-4 text-2xl font-semibold text-gray-900">{title}</h2>

      {bookings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center shadow-sm">
          <DoorOpen className="mx-auto mb-4 h-16 w-16 text-gray-400" />
          <p className="text-lg font-semibold text-gray-700">{emptyTitle}</p>
          <p className="mt-2 text-sm text-gray-500">{emptyDescription}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {bookings.map((booking) => {
            const room = rooms.find((r) => r.id === booking.roomId);
            return (
              <BookingCard
                key={booking.id}
                booking={booking}
                room={room}
                isNew={newBookingIds.includes(booking.id)}
                onEdit={onEdit}
                onCancel={onCancel}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
