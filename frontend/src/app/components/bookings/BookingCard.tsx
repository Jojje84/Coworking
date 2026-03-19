import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { Calendar, Clock, MapPin, Pencil, Trash2 } from "lucide-react";
import { Booking, Room } from "../../types";
import { isBookingPast } from "../../../utils/booking";

type BookingCardProps = {
  booking: Booking;
  room?: Room;
  isNew?: boolean;
  onEdit?: (bookingId: string) => void;
  onCancel?: (bookingId: string) => void;
};

export function BookingCard({
  booking,
  room,
  isNew = false,
  onEdit,
  onCancel,
}: BookingCardProps) {
  const isPast = isBookingPast(booking.endTime);
  const canManage = booking.status === "active" && !isPast;

  const displayStatus =
    booking.status === "active" && !isPast
      ? "Active"
      : booking.status === "cancelled"
        ? "Cancelled"
        : "Completed";

  const statusClasses =
    displayStatus === "Active"
      ? "bg-green-100 text-green-800"
      : displayStatus === "Cancelled"
        ? "bg-red-100 text-red-800"
        : "bg-gray-100 text-gray-800";

  return (
    <div
      className={`overflow-hidden rounded-2xl border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
        isNew ? "border-blue-200 bg-blue-50/40" : "border-gray-100 bg-white"
      }`}
    >
      <img
        src={room?.imageUrl}
        alt={room?.name}
        className="h-52 w-full object-cover"
      />

      <div className="p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold text-gray-900">
                {room?.name ?? "Unknown room"}
              </h3>
              {isNew && (
                <span className="inline-flex rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  New
                </span>
              )}
            </div>

            <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4" />
              <span>
                {room?.type === "workspace" ? "Workspace" : "Conference Room"}
              </span>
            </div>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses}`}
          >
            {displayStatus}
          </span>
        </div>

        <div className="mb-5 space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Calendar className="h-4 w-4 text-blue-600" />
            <span>
              {format(new Date(booking.startTime), "PPP", { locale: sv })}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Clock className="h-4 w-4 text-blue-600" />
            <span>
              {format(new Date(booking.startTime), "HH:mm")} -{" "}
              {format(new Date(booking.endTime), "HH:mm")}
            </span>
          </div>

          {isNew && (
            <div className="text-xs font-medium text-blue-700">Just now</div>
          )}
        </div>

        {canManage && (
          <div className="flex gap-2">
            <button
              onClick={() => onEdit?.(booking.id)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-50 px-4 py-2.5 font-medium text-blue-700 transition-colors hover:bg-blue-100"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>

            <button
              onClick={() => onCancel?.(booking.id)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 font-medium text-red-700 transition-colors hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" />
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
