import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { Calendar, Trash2 } from "lucide-react";
import {
  getBookingCreatedTime,
  getBookingUpdatedTime,
} from "../../../utils/booking";

type BookingItem = {
  id: string;
  roomId: string;
  userId: string;
  startTime: string;
  endTime: string;
  status: "active" | "completed" | "cancelled";
  createdAt: string;
  updatedAt?: string;
};

type RoomItem = {
  id: string;
  name: string;
  type: string;
};

type UserItem = {
  id: string;
  username: string;
  email: string;
  isDeleted?: boolean;
};

type AdminBookingsTableProps = {
  bookings: BookingItem[];
  rooms: RoomItem[];
  users: UserItem[];
  newBookingIds: string[];
  now: number;
  recentWindowMs: number;
  hasActionableBookings: boolean;
  hasHardDeletableBookings: boolean;
  canHardDelete: boolean;
  onCancelBooking: (bookingId: string) => void;
  onOpenHardDelete: (bookingId: string) => void;
};

function EmptyState() {
  return (
    <div className="p-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <Calendar className="h-8 w-8 text-gray-400" />
      </div>
      <p className="mt-4 text-lg font-semibold text-gray-700">
        No bookings found
      </p>
      <p className="mt-2 text-sm text-gray-500">
        Try changing your search or filter settings.
      </p>
    </div>
  );
}

export function AdminBookingsTable({
  bookings,
  rooms,
  users,
  newBookingIds,
  now,
  recentWindowMs,
  hasActionableBookings,
  hasHardDeletableBookings,
  canHardDelete,
  onCancelBooking,
  onOpenHardDelete,
}: AdminBookingsTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Booking overview
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Detailed list of all filtered bookings
        </p>
      </div>

      {bookings.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Room
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  User
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Time
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Last activity
                </th>
                {(hasActionableBookings ||
                  (hasHardDeletableBookings && canHardDelete)) && (
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Actions
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 bg-white">
              {bookings.map((booking) => {
                const room = rooms.find((r) => r.id === booking.roomId);
                const user = users.find((u) => u.id === booking.userId);
                const isDeletedUser = Boolean(user?.isDeleted);

                const createdTime = getBookingCreatedTime(booking);
                const updatedTime = getBookingUpdatedTime(booking);
                const isNew =
                  newBookingIds.includes(booking.id) ||
                  now - createdTime <= recentWindowMs;

                const isUpdated =
                  !isNew &&
                  updatedTime > createdTime + 1000 &&
                  now - updatedTime <= recentWindowMs;

                const displayStatus =
                  booking.status === "active"
                    ? "Active"
                    : booking.status === "cancelled"
                      ? "Cancelled"
                      : "Completed";

                const statusClasses =
                  booking.status === "active"
                    ? "bg-green-100 text-green-800"
                    : booking.status === "cancelled"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-800";

                const rowHighlightClass = isNew
                  ? "bg-blue-50/70"
                  : isUpdated
                    ? "bg-amber-50/80"
                    : "";

                const activityText =
                  isNew || isUpdated
                    ? "Just now"
                    : format(new Date(updatedTime), "PP", { locale: sv });

                return (
                  <tr
                    key={booking.id}
                    className={`transition-colors hover:bg-gray-50/80 ${rowHighlightClass}`}
                  >
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-gray-900">
                          {room?.name ?? "Unknown room"}
                        </div>

                        {isNew && (
                          <span className="inline-flex rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                            New
                          </span>
                        )}

                        {isUpdated && (
                          <span className="inline-flex rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                            Updated
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-gray-500">
                        {room?.type === "workspace"
                          ? "Workspace"
                          : "Conference Room"}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user?.username ?? "Unknown user"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {user?.email ?? "No email"}
                      </div>
                      {isDeletedUser && (
                        <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          User soft deleted
                        </span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {format(new Date(booking.startTime), "PP", {
                        locale: sv,
                      })}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {format(new Date(booking.startTime), "HH:mm")} -{" "}
                      {format(new Date(booking.endTime), "HH:mm")}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses}`}
                      >
                        {displayStatus}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {activityText}
                    </td>

                    {(hasActionableBookings ||
                      (hasHardDeletableBookings && canHardDelete)) && (
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-2">
                          {booking.status === "active" && (
                            <button
                              type="button"
                              onClick={() => onCancelBooking(booking.id)}
                              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
                            >
                              <Trash2 className="h-4 w-4" />
                              Cancel
                            </button>
                          )}

                          {canHardDelete &&
                            (booking.status === "cancelled" ||
                              booking.status === "completed") && (
                              <button
                                type="button"
                                onClick={() => onOpenHardDelete(booking.id)}
                                className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete permanently
                              </button>
                            )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
