// ─────────────────────────────────────────
// Admin Bookings
// ─────────────────────────────────────────

import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRooms } from "../context/RoomsContext";
import { useBookings } from "../context/BookingsContext";
import { useUsers } from "../context/UsersContext";
import { Layout } from "../components/Layout";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { CheckCircle2, Clock3, ClipboardList, Trash2 } from "lucide-react";
import { getBookingLastActivityTime } from "../../utils/booking";
import { AdminBookingsFilters } from "../components/bookings/AdminBookingsFilters";
import { AdminBookingsTable } from "../components/bookings/AdminBookingsTable";

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

export function AdminBookings() {
  const { user: currentUser } = useAuth();
  const { rooms } = useRooms();
  const { users } = useUsers();
  const { bookings, newBookingIds, deleteBooking, hardDeleteBooking } =
    useBookings();

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
        (a: any, b: any) =>
          getBookingLastActivityTime(b) - getBookingLastActivityTime(a),
      );
  }, [bookings, rooms, users, searchQuery, filterStatus, filterOwnerState]);

  const hasActionableBookings = useMemo(
    () => filteredBookings.some((booking: any) => booking.status === "active"),
    [filteredBookings],
  );
  const hasHardDeletableBookings = useMemo(
    () =>
      filteredBookings.some(
        (booking: any) =>
          booking.status === "cancelled" || booking.status === "completed",
      ),
    [filteredBookings],
  );
  const canHardDelete = Boolean(currentUser?.permissions?.bookingHardDelete);

  const activeCount = bookings.filter((b) => b.status === "active").length;
  const completedCount = bookings.filter(
    (b) => b.status === "completed",
  ).length;
  const cancelledCount = bookings.filter(
    (b) => b.status === "cancelled",
  ).length;

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

        <AdminBookingsFilters
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          filterStatus={filterStatus}
          onFilterStatusChange={setFilterStatus}
          filterOwnerState={filterOwnerState}
          onFilterOwnerStateChange={setFilterOwnerState}
        />

        <AdminBookingsTable
          bookings={filteredBookings as any}
          rooms={rooms as any}
          users={users as any}
          newBookingIds={newBookingIds}
          now={now}
          recentWindowMs={RECENT_WINDOW_MS}
          hasActionableBookings={hasActionableBookings}
          hasHardDeletableBookings={hasHardDeletableBookings}
          canHardDelete={canHardDelete}
          onCancelBooking={setDeletingBookingId}
          onOpenHardDelete={(bookingId) => {
            setHardDeleteConfirmText("");
            setHardDeletingBookingId(bookingId);
          }}
        />
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
