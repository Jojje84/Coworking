// ─────────────────────────────────────────
// Admin Bookings
// ─────────────────────────────────────────

import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import {
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Trash2,
} from "lucide-react";

type StatCardProps = {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
};

const RECENT_WINDOW_MS = 15000;

function StatCard({ title, value, subtitle, icon }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            {value}
          </p>
          <p className="mt-2 text-sm text-gray-500">{subtitle}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-700">
          {icon}
        </div>
      </div>
    </div>
  );
}

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

function getCreatedTime(booking: any) {
  return new Date(booking.createdAt).getTime();
}

function getUpdatedTime(booking: any) {
  const updatedAt = booking.updatedAt ?? booking.createdAt;
  return new Date(updatedAt).getTime();
}

function getLastActivityTime(booking: any) {
  return Math.max(getCreatedTime(booking), getUpdatedTime(booking));
}

export function AdminBookings() {
  const { user: currentUser } = useAuth();
  const { bookings, rooms, users, newBookingIds, deleteBooking, hardDeleteBooking } = useData();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "active" | "completed" | "cancelled"
  >("all");
  const [filterOwnerState, setFilterOwnerState] = useState<
    "all" | "active-users" | "deleted-users"
  >("all");
  const [deletingBookingId, setDeletingBookingId] = useState<string | null>(
    null,
  );
  const [hardDeletingBookingId, setHardDeletingBookingId] = useState<
    string | null
  >(null);
  const [hardDeleteConfirmText, setHardDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isHardDeleting, setIsHardDeleting] = useState(false);

  const now = Date.now();

  const filteredBookings = useMemo(() => {
    return bookings
      .filter((booking: any) => {
        const room = rooms.find((r) => r.id === booking.roomId);
        const user = users.find((u) => u.id === booking.userId);

        const search = searchQuery.toLowerCase().trim();

        const matchesSearch =
          !search ||
          room?.name.toLowerCase().includes(search) ||
          user?.username.toLowerCase().includes(search) ||
          user?.email.toLowerCase().includes(search);

        const matchesStatus =
          filterStatus === "all" || booking.status === filterStatus;

        const isDeletedUser = Boolean(user?.isDeleted);
        const matchesOwnerState =
          filterOwnerState === "all" ||
          (filterOwnerState === "deleted-users" && isDeletedUser) ||
          (filterOwnerState === "active-users" && !isDeletedUser);

        return matchesSearch && matchesStatus && matchesOwnerState;
      })
      .sort(
        (a: any, b: any) => getLastActivityTime(b) - getLastActivityTime(a),
      );
  }, [bookings, rooms, users, searchQuery, filterStatus, filterOwnerState]);

  const hasActionableBookings = useMemo(
    () => filteredBookings.some((booking: any) => booking.status === "active"),
    [filteredBookings],
  );
  const hasHardDeletableBookings = useMemo(
    () =>
      filteredBookings.some(
        (booking: any) => booking.status === "cancelled" || booking.status === "completed",
      ),
    [filteredBookings],
  );
  const canHardDelete = Boolean(currentUser?.permissions?.bookingHardDelete);

  const activeCount = bookings.filter((b) => b.status === "active").length;
  const completedCount = bookings.filter((b) => b.status === "completed").length;
  const cancelledCount = bookings.filter((b) => b.status === "cancelled").length;

  const bookingToDelete = deletingBookingId
    ? (bookings.find((b) => b.id === deletingBookingId) ?? null)
    : null;

  const deleteRoom = bookingToDelete
    ? rooms.find((r) => r.id === bookingToDelete.roomId)
    : null;

  const deleteUser = bookingToDelete
    ? users.find((u) => u.id === bookingToDelete.userId)
    : null;

  const bookingToHardDelete = hardDeletingBookingId
    ? (bookings.find((b) => b.id === hardDeletingBookingId) ?? null)
    : null;

  const hardDeleteRoom = bookingToHardDelete
    ? rooms.find((r) => r.id === bookingToHardDelete.roomId)
    : null;

  const hardDeleteUser = bookingToHardDelete
    ? users.find((u) => u.id === bookingToHardDelete.userId)
    : null;

  const handleDeleteBooking = async () => {
    if (!deletingBookingId) return;

    try {
      setIsDeleting(true);
      const success = await deleteBooking(deletingBookingId);

      if (success) {
        setDeletingBookingId(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleHardDeleteBooking = async () => {
    if (!hardDeletingBookingId) return;

    if (hardDeleteConfirmText.trim() !== "DELETE") {
      return;
    }

    try {
      setIsHardDeleting(true);
      const success = await hardDeleteBooking(
        hardDeletingBookingId,
        hardDeleteConfirmText.trim(),
      );

      if (success) {
        setHardDeletingBookingId(null);
        setHardDeleteConfirmText("");
      }
    } finally {
      setIsHardDeleting(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-sm">
          <h1 className="text-3xl font-bold">All Bookings</h1>
          <p className="mt-2 text-sm text-gray-300">
            Overview of all bookings in the system, including status and user
            details.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <StatCard
            title="Total bookings"
            value={bookings.length}
            subtitle="All bookings in the system"
            icon={<ClipboardList className="h-6 w-6 text-blue-600" />}
          />
          <StatCard
            title="Active"
            value={activeCount}
            subtitle="Bookings currently active"
            icon={<CheckCircle2 className="h-6 w-6 text-green-600" />}
          />
          <StatCard
            title="Completed"
            value={completedCount}
            subtitle="Finished bookings"
            icon={<Clock3 className="h-6 w-6 text-gray-600" />}
          />
          <StatCard
            title="Cancelled"
            value={cancelledCount}
            subtitle="Cancelled bookings"
            icon={<Trash2 className="h-6 w-6 text-red-600" />}
          />
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-gray-900">
              Search and filter
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Find bookings by room, username, email, status or user state.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                <Search className="mr-1 inline h-4 w-4" />
                Search bookings
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for room, username or email..."
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                <Filter className="mr-1 inline h-4 w-4" />
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) =>
                  setFilterStatus(
                    e.target.value as
                      | "all"
                      | "active"
                      | "completed"
                      | "cancelled",
                  )
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                User state
              </label>
              <select
                value={filterOwnerState}
                onChange={(e) =>
                  setFilterOwnerState(
                    e.target.value as "all" | "active-users" | "deleted-users",
                  )
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All users</option>
                <option value="active-users">Active users only</option>
                <option value="deleted-users">Soft deleted users only</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Booking overview
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Detailed list of all filtered bookings
            </p>
          </div>

          {filteredBookings.length === 0 ? (
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
                    {(hasActionableBookings || (hasHardDeletableBookings && canHardDelete)) && (
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredBookings.map((booking: any) => {
                    const room = rooms.find((r) => r.id === booking.roomId);
                    const user = users.find((u) => u.id === booking.userId);
                    const isDeletedUser = Boolean(user?.isDeleted);

                    const createdTime = getCreatedTime(booking);
                    const updatedTime = getUpdatedTime(booking);
                    const isNew =
                      newBookingIds.includes(booking.id) ||
                      now - createdTime <= RECENT_WINDOW_MS;

                    const isUpdated =
                      !isNew &&
                      updatedTime > createdTime + 1000 &&
                      now - updatedTime <= RECENT_WINDOW_MS;

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
                        : format(new Date(updatedTime), "PP", {
                            locale: sv,
                          });

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

                        {(hasActionableBookings || (hasHardDeletableBookings && canHardDelete)) && (
                          <td className="whitespace-nowrap px-6 py-4">
                            <div className="flex items-center gap-2">
                              {booking.status === "active" && (
                                <button
                                  type="button"
                                  onClick={() => setDeletingBookingId(booking.id)}
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
                                  onClick={() => {
                                    setHardDeleteConfirmText("");
                                    setHardDeletingBookingId(booking.id);
                                  }}
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
      </div>

      {deletingBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-gray-900">
              Cancel booking
            </h3>

            <p className="mt-3 text-sm leading-6 text-gray-600">
              Are you sure you want to cancel this booking?
            </p>

            <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
              <p>
                <span className="font-semibold">Room:</span>{" "}
                {deleteRoom?.name ?? "Unknown room"}
              </p>
              <p className="mt-1">
                <span className="font-semibold">User:</span>{" "}
                {deleteUser?.username ?? "Unknown user"}
              </p>
              <p className="mt-1">
                <span className="font-semibold">Date:</span>{" "}
                {bookingToDelete
                  ? format(new Date(bookingToDelete.startTime), "PP", {
                      locale: sv,
                    })
                  : "-"}
              </p>
              <p className="mt-1">
                <span className="font-semibold">Time:</span>{" "}
                {bookingToDelete
                  ? `${format(new Date(bookingToDelete.startTime), "HH:mm")} - ${format(new Date(bookingToDelete.endTime), "HH:mm")}`
                  : "-"}
              </p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingBookingId(null)}
                disabled={isDeleting}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteBooking}
                disabled={isDeleting}
                className="inline-flex items-center rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "Cancelling..." : "Cancel booking"}
              </button>
            </div>
          </div>
        </div>
      )}

      {hardDeletingBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-gray-900">
              Delete booking permanently
            </h3>

            <p className="mt-3 text-sm leading-6 text-gray-600">
              This will permanently remove the booking from the system. Type
              DELETE to continue.
            </p>

            <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
              <p>
                <span className="font-semibold">Room:</span>{" "}
                {hardDeleteRoom?.name ?? "Unknown room"}
              </p>
              <p className="mt-1">
                <span className="font-semibold">User:</span>{" "}
                {hardDeleteUser?.username ?? "Unknown user"}
              </p>
              <p className="mt-1">
                <span className="font-semibold">Date:</span>{" "}
                {bookingToHardDelete
                  ? format(new Date(bookingToHardDelete.startTime), "PP", {
                      locale: sv,
                    })
                  : "-"}
              </p>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Confirmation text
              </label>
              <input
                type="text"
                value={hardDeleteConfirmText}
                onChange={(e) => setHardDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setHardDeletingBookingId(null);
                  setHardDeleteConfirmText("");
                }}
                disabled={isHardDeleting}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleHardDeleteBooking}
                disabled={
                  isHardDeleting || hardDeleteConfirmText.trim() !== "DELETE"
                }
                className="inline-flex items-center rounded-xl bg-red-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isHardDeleting ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
