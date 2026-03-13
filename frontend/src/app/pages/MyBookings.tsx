// ─────────────────────────────────────────
// My Bookings
// ─────────────────────────────────────────

import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { Layout } from "../components/Layout";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import {
  Calendar,
  Clock,
  MapPin,
  Pencil,
  Trash2,
  DoorOpen,
  CheckCircle2,
  AlertCircle,
  History,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

type NoticeState = {
  type: "success" | "error";
  message: string;
} | null;

type StatCardProps = {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
};

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

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center shadow-sm">
      <DoorOpen className="mx-auto mb-4 h-16 w-16 text-gray-400" />
      <p className="text-lg font-semibold text-gray-700">{title}</p>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
    </div>
  );
}

export function MyBookings() {
  const { user } = useAuth();
  const { bookings, rooms, deleteBooking, updateBooking, newBookingIds } =
    useData();

  const [editingBooking, setEditingBooking] = useState<string | null>(null);
  const [deletingBooking, setDeletingBooking] = useState<string | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notice, setNotice] = useState<NoticeState>(null);

  const userBookings = useMemo(() => {
    return bookings
      .filter((b) => b.userId === user?.id)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [bookings, user?.id]);

  const activeBookings = userBookings.filter(
    (b) => b.status === "active" && new Date(b.endTime) >= new Date(),
  );

  const pastBookings = userBookings.filter(
    (b) => b.status !== "active" || new Date(b.endTime) < new Date(),
  );

  const handleEdit = (bookingId: string) => {
    setNotice(null);

    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    setEditingBooking(bookingId);
    setStartTime(format(new Date(booking.startTime), "yyyy-MM-dd'T'HH:mm"));
    setEndTime(format(new Date(booking.endTime), "yyyy-MM-dd'T'HH:mm"));
  };

  const handleUpdate = async () => {
    if (!editingBooking) return;

    if (!startTime || !endTime) {
      setNotice({
        type: "error",
        message: "Please fill in both start and end time.",
      });
      return;
    }

    if (new Date(startTime) >= new Date(endTime)) {
      setNotice({
        type: "error",
        message: "End time must be later than start time.",
      });
      return;
    }

    const success = await updateBooking(editingBooking, {
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
    });

    if (success) {
      setEditingBooking(null);
      setNotice({
        type: "success",
        message: "Booking updated successfully.",
      });
    } else {
      setNotice({
        type: "error",
        message: "Could not update booking.",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingBooking) return;

    const success = await deleteBooking(deletingBooking);

    if (success) {
      setDeletingBooking(null);
      setNotice({
        type: "success",
        message: "Booking deleted successfully.",
      });
    } else {
      setNotice({
        type: "error",
        message: "Could not delete booking.",
      });
    }
  };

  const BookingCard = ({ booking }: { booking: (typeof bookings)[0] }) => {
    const room = rooms.find((r) => r.id === booking.roomId);
    const isPast = new Date(booking.endTime) < new Date();
    const isNew = newBookingIds.includes(booking.id);

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

          {booking.status === "active" && !isPast && (
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(booking.id)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-50 px-4 py-2.5 font-medium text-blue-700 transition-colors hover:bg-blue-100"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>

              <button
                onClick={() => {
                  setNotice(null);
                  setDeletingBooking(booking.id);
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 font-medium text-red-700 transition-colors hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm">
          <h1 className="text-3xl font-bold">My Bookings</h1>
          <p className="mt-2 text-sm text-blue-100">
            View, update and manage your room reservations.
          </p>
        </div>

        {notice && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              notice.type === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {notice.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <span>{notice.message}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <StatCard
            title="All bookings"
            value={userBookings.length}
            subtitle="All your reservations"
            icon={<Calendar className="h-6 w-6 text-blue-600" />}
          />
          <StatCard
            title="Active bookings"
            value={activeBookings.length}
            subtitle="Current upcoming reservations"
            icon={<CheckCircle2 className="h-6 w-6 text-green-600" />}
          />
          <StatCard
            title="History"
            value={pastBookings.length}
            subtitle="Completed bookings"
            icon={<History className="h-6 w-6 text-gray-600" />}
          />
        </div>

        <div>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            Active Bookings
          </h2>

          {activeBookings.length === 0 ? (
            <EmptyState
              title="You have no active bookings"
              description='Go to "Book Room" to create a new booking.'
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {activeBookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </div>

        {pastBookings.length > 0 && (
          <div>
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">
              Previous Bookings
            </h2>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {pastBookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog.Root
        open={!!editingBooking}
        onOpenChange={(open) => {
          if (!open) setEditingBooking(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <Dialog.Title className="text-xl font-semibold text-gray-900">
                Edit Booking
              </Dialog.Title>
              <Dialog.Close className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Start time
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  End time
                </label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setEditingBooking(null)}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 font-medium transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Save changes
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={!!deletingBooking}
        onOpenChange={(open) => {
          if (!open) setDeletingBooking(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>

              <div className="flex-1">
                <Dialog.Title className="text-lg font-semibold text-gray-900">
                  Delete booking
                </Dialog.Title>
                <p className="mt-1 text-sm text-gray-600">
                  Are you sure you want to permanently delete this booking?
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDeletingBooking(null)}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 font-medium transition-colors hover:bg-gray-50"
              >
                Keep booking
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-red-700"
              >
                Delete booking
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Layout>
  );
}



