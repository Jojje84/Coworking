import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { sv } from "date-fns/locale";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  DoorOpen,
} from "lucide-react";
import { toDateKey } from "../../../utils/date";
import { sortByStartTimeAsc } from "../../../utils/booking";

export type DashboardBooking = {
  id: string;
  userId: string;
  roomId: string;
  startTime: string;
  endTime: string;
  status: "active" | "completed" | "cancelled";
  createdAt: string;
};

type DashboardCalendarProps = {
  title: string;
  bookings: DashboardBooking[];
  rooms: {
    id: string;
    name: string;
  }[];
  users?: {
    id: string;
    username: string;
  }[];
  showUserName?: boolean;
};

type StatCardProps = {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
};

type BookingListPanelProps = {
  title: string;
  subtitle: string;
  bookings: DashboardBooking[];
  emptyTitle: string;
  emptyDescription: string;
  rooms: { id: string; name: string }[];
  users?: { id: string; username: string }[];
  showUserName?: boolean;
  showStatus?: boolean;
  dateFormat?: string;
};

export function StatCard({ title, value, subtitle, icon }: StatCardProps) {
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

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
        <Calendar className="h-7 w-7 text-gray-400" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  );
}

export function DashboardCalendarCard({
  title,
  bookings,
  rooms,
  users = [],
  showUserName = false,
}: DashboardCalendarProps) {
  const today = startOfDay(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [currentMonth, setCurrentMonth] = useState<Date>(today);

  const activeBookings = useMemo(
    () => bookings.filter((b) => b.status === "active"),
    [bookings],
  );

  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({
      start: calendarStart,
      end: calendarEnd,
    });
  }, [currentMonth]);

  const selectedDateKey = toDateKey(selectedDate);

  const bookingsForSelectedDate = useMemo(() => {
    const sameDay = activeBookings.filter(
      (booking) => toDateKey(new Date(booking.startTime)) === selectedDateKey,
    );
    return sortByStartTimeAsc(sameDay);
  }, [activeBookings, selectedDateKey]);

  const hasAnyBookingOnDate = (date: Date) => {
    const dateKey = toDateKey(date);
    return activeBookings.some(
      (booking) => toDateKey(new Date(booking.startTime)) === dateKey,
    );
  };

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);

    if (!isSameMonth(date, currentMonth)) {
      setCurrentMonth(startOfMonth(date));
    }
  };

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">
            Select a date to view all active bookings
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 12))}
                className="rounded-xl border border-gray-200 p-2 text-gray-700 transition-colors hover:bg-gray-50"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="rounded-xl border border-gray-200 p-2 text-gray-700 transition-colors hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-900">
              {format(currentMonth, "MMMM yyyy")}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="rounded-xl border border-gray-200 p-2 text-gray-700 transition-colors hover:bg-gray-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 12))}
                className="rounded-xl border border-gray-200 p-2 text-gray-700 transition-colors hover:bg-gray-50"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1.5">
            {weekDays.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-xs font-bold uppercase tracking-wide text-gray-500"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {monthDays.map((date) => {
              const isSelected = isSameDay(date, selectedDate);
              const isCurrentMonthDay = isSameMonth(date, currentMonth);
              const isPast = isBefore(date, today);
              const hasBookings = hasAnyBookingOnDate(date);

              let dayClasses =
                "h-10 rounded-xl text-sm font-semibold transition-all ";

              if (isSelected) {
                dayClasses +=
                  "bg-blue-600 text-white shadow-sm hover:bg-blue-700";
              } else if (!isCurrentMonthDay) {
                dayClasses += "border border-gray-100 bg-gray-50 text-gray-300";
              } else if (isPast) {
                dayClasses += "border border-gray-100 bg-gray-50 text-gray-400";
              } else if (hasBookings) {
                dayClasses +=
                  "border border-yellow-200 bg-yellow-100 text-yellow-800 hover:bg-yellow-200";
              } else {
                dayClasses +=
                  "border border-green-200 bg-green-100 text-green-800 hover:bg-green-200";
              }

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => handleSelectDate(date)}
                  className={dayClasses}
                >
                  {format(date, "d")}
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2 text-xs text-gray-600 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
              <span className="h-3 w-3 rounded-full border border-green-300 bg-green-200" />
              <span>Free day</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
              <span className="h-3 w-3 rounded-full border border-yellow-300 bg-yellow-200" />
              <span>Has bookings</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
              <span className="h-3 w-3 rounded-full bg-blue-600" />
              <span>Selected day</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Bookings on {format(selectedDate, "PPP", { locale: sv })}
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                {bookingsForSelectedDate.length === 0
                  ? "No active bookings on this date"
                  : `${bookingsForSelectedDate.length} active booking${bookingsForSelectedDate.length > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          {bookingsForSelectedDate.length === 0 ? (
            <EmptyState
              title="No bookings on this date"
              description="This day is currently free for bookings."
            />
          ) : (
            <div className="space-y-3">
              {bookingsForSelectedDate.map((booking) => {
                const room = rooms.find((r) => r.id === booking.roomId);
                const bookingUser = users.find((u) => u.id === booking.userId);

                return (
                  <div
                    key={booking.id}
                    className="rounded-2xl border border-yellow-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-gray-900">
                          {room?.name ?? "Unknown room"}
                        </p>

                        {showUserName && (
                          <p className="mt-1 text-sm text-gray-600">
                            Booked by: {bookingUser?.username ?? "Unknown user"}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700">
                            <Clock3 className="h-3.5 w-3.5" />
                            {format(
                              new Date(booking.startTime),
                              "HH:mm",
                            )} - {format(new Date(booking.endTime), "HH:mm")}
                          </span>
                        </div>
                      </div>

                      <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                        Active
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function BookingListPanel({
  title,
  subtitle,
  bookings,
  emptyTitle,
  emptyDescription,
  rooms,
  users = [],
  showUserName = false,
  showStatus = false,
  dateFormat = "PPP",
}: BookingListPanelProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-6">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </div>

      <div className="p-6">
        {bookings.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
              const room = rooms.find((r) => r.id === booking.roomId);
              const bookingUser = users.find((u) => u.id === booking.userId);

              return (
                <div
                  key={booking.id}
                  className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100">
                      <DoorOpen className="h-6 w-6 text-blue-600" />
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {room?.name ?? "Unknown room"}
                      </h3>

                      {showUserName && (
                        <p className="text-sm text-gray-600">
                          Booked by: {bookingUser?.username ?? "Unknown user"}
                        </p>
                      )}

                      <p className="text-sm text-gray-600">
                        {format(new Date(booking.startTime), dateFormat, {
                          locale: sv,
                        })}
                      </p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(booking.startTime), "HH:mm")} -{" "}
                        {format(new Date(booking.endTime), "HH:mm")}
                      </p>
                    </div>
                  </div>

                  {showStatus && (
                    <span
                      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ${
                        booking.status === "active"
                          ? "bg-green-100 text-green-800"
                          : booking.status === "completed"
                            ? "bg-gray-200 text-gray-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {booking.status === "active"
                        ? "Active"
                        : booking.status === "completed"
                          ? "Completed"
                          : "Cancelled"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
