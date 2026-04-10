// ─────────────────────────────────────────
// My Bookings
// ─────────────────────────────────────────

import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRooms } from "../context/RoomsContext";
import { useBookings } from "../context/BookingsContext";
import { Layout } from "../components/Layout";
import { format } from "date-fns";
import {
  Calendar,
  Trash2,
  CheckCircle2,
  AlertCircle,
  History,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { isBookingPast, sortByCreatedAtDesc } from "../../utils/booking";
import { BookingForm } from "../components/bookings/BookingForm";
import { BookingList } from "../components/bookings/BookingList";

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

export function MyBookings() {
  const { user } = useAuth();
  const { rooms } = useRooms();
  const { bookings, deleteBooking, updateBooking, newBookingIds } =
    useBookings();

  const [editingBooking, setEditingBooking] = useState<string | null>(null);
  const [deletingBooking, setDeletingBooking] = useState<string | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notice, setNotice] = useState<NoticeState>(null);

  const userBookings = useMemo(() => {
    return sortByCreatedAtDesc(bookings.filter((b) => b.userId === user?.id));
  }, [bookings, user?.id]);

  const activeBookings = userBookings.filter(
    (b) => b.status === "active" && !isBookingPast(b.endTime),
  );

  const pastBookings = userBookings.filter(
    (b) => b.status !== "active" || isBookingPast(b.endTime),
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
        message: "Booking cancelled successfully.",
      });
    } else {
      setNotice({
        type: "error",
        message: "Could not cancel booking.",
      });
    }
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

        <BookingList
          title="Active Bookings"
          bookings={activeBookings}
          rooms={rooms}
          newBookingIds={newBookingIds}
          onEdit={handleEdit}
          onCancel={(bookingId) => {
            setNotice(null);
            setDeletingBooking(bookingId);
          }}
          emptyTitle="You have no active bookings"
          emptyDescription='Go to "Book Room" to create a new booking.'
        />

        {pastBookings.length > 0 && (
          <BookingList
            title="Previous Bookings"
            bookings={pastBookings}
            rooms={rooms}
            newBookingIds={newBookingIds}
            emptyTitle="No previous bookings"
            emptyDescription="Your booking history will appear here."
          />
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
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <Dialog.Title className="text-xl font-semibold text-gray-900">
                Edit Booking
              </Dialog.Title>
              <Dialog.Close className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>

            <BookingForm
              startTime={startTime}
              endTime={endTime}
              onStartTimeChange={setStartTime}
              onEndTimeChange={setEndTime}
              onCancel={() => setEditingBooking(null)}
              onSubmit={handleUpdate}
            />
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
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>

              <div className="flex-1">
                <Dialog.Title className="text-lg font-semibold text-gray-900">
                  Cancel booking
                </Dialog.Title>
                <p className="mt-1 text-sm text-gray-600">
                  Are you sure you want to cancel this booking?
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
                Cancel booking
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Layout>
  );
}
