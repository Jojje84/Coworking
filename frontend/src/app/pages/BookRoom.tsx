// ─────────────────────────────────────────
// Book Room
// ─────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { Layout } from "../components/Layout";
import { useNavigate } from "react-router";
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
import {
  Users,
  MapPin,
  Search,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  AlertCircle,
  DoorOpen,
} from "lucide-react";
import { RoomType } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

function toDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function toTimeLabel(iso: string) {
  return format(new Date(iso), "HH:mm");
}

function getOrderedTimes(startIso: string, endIso: string) {
  const startDate = new Date(startIso);
  const endDate = new Date(endIso);

  if (startDate <= endDate) {
    return {
      start: toTimeLabel(startIso),
      end: toTimeLabel(endIso),
    };
  }

  return {
    start: toTimeLabel(endIso),
    end: toTimeLabel(startIso),
  };
}

function formatForDateTimeLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getDefaultBookingTimes() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  now.setSeconds(0);
  now.setMilliseconds(0);

  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  return {
    start: formatForDateTimeLocal(now),
    end: formatForDateTimeLocal(oneHourLater),
  };
}

type NoticeState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

export function BookRoom() {
  const { user, token } = useAuth();
  const { rooms, calendarBookings, loadCalendarBookings, addBooking } =
    useData();
  const navigate = useNavigate();

  const today = startOfDay(new Date());

  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<RoomType | "all">("all");
  const [filterCapacity, setFilterCapacity] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [currentMonth, setCurrentMonth] = useState<Date>(today);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    loadCalendarBookings(monthStart.toISOString(), monthEnd.toISOString());
  }, [currentMonth, loadCalendarBookings]);

  const filteredRooms = rooms
    .filter((room) => {
      const matchesSearch = room.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesType = filterType === "all" || room.type === filterType;
      const matchesCapacity =
        filterCapacity === 0 || room.capacity >= filterCapacity;

      return matchesSearch && matchesType && matchesCapacity;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const selectedRoomData = rooms.find((r) => r.id === selectedRoom);

  const activeBookings = calendarBookings.filter((b) => b.status === "active");
  const selectedDateKey = toDateKey(selectedDate);

  const bookingsForSelectedDate = useMemo(() => {
    return activeBookings.filter(
      (booking) => toDateKey(new Date(booking.startTime)) === selectedDateKey,
    );
  }, [activeBookings, selectedDateKey]);

  const groupedBookingsForSelectedDate = useMemo(() => {
    const grouped = new Map<
      string,
      {
        roomName: string;
        slots: {
          id: string;
          start: string;
          end: string;
          isOwnBooking: boolean;
        }[];
      }
    >();

    for (const booking of bookingsForSelectedDate) {
      if (!grouped.has(booking.roomId)) {
        grouped.set(booking.roomId, {
          roomName: booking.roomName,
          slots: [],
        });
      }

      grouped.get(booking.roomId)?.slots.push({
        id: booking.id,
        start: booking.startTime,
        end: booking.endTime,
        isOwnBooking: booking.isMine,
      });
    }

    return Array.from(grouped.entries()).map(([roomId, value]) => ({
      roomId,
      roomName: value.roomName,
      slots: value.slots.sort((a, b) => a.start.localeCompare(b.start)),
    }));
  }, [bookingsForSelectedDate]);

  const hasAnyBookingOnDate = (date: Date) => {
    const dateKey = toDateKey(date);
    return activeBookings.some(
      (booking) => toDateKey(new Date(booking.startTime)) === dateKey,
    );
  };

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

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const handleSelectDate = (date: Date) => {
    if (isBefore(date, today)) return;

    setSelectedDate(date);
    setNotice(null);

    if (!isSameMonth(date, currentMonth)) {
      setCurrentMonth(startOfMonth(date));
    }
  };

  const validateBookingInput = () => {
    if (!selectedRoom || !startTime || !endTime) {
      setNotice({
        type: "error",
        message: "Please select a room and fill in both time fields.",
      });
      return false;
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const now = new Date();
    const graceMs = 60 * 1000;

    if (startDate >= endDate) {
      setNotice({
        type: "error",
        message: "End time must be later than start time.",
      });
      return false;
    }

    if (startDate.getTime() < now.getTime() - graceMs) {
      setNotice({
        type: "error",
        message: "You cannot create a booking in the past.",
      });
      return false;
    }

    if (!user || !token) {
      setNotice({
        type: "error",
        message: "You must be logged in to make a booking.",
      });
      return false;
    }

    return true;
  };

  const handleBooking = async () => {
    setNotice(null);

    if (!validateBookingInput()) return;

    try {
      setIsSubmitting(true);

      const success = await addBooking({
        userId: user!.id,
        roomId: selectedRoom,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      });

      if (success) {
        setNotice({
          type: "success",
          message: "Booking created successfully.",
        });
        navigate("/bookings");
      } else {
        setNotice({
          type: "error",
          message: "Could not create booking. Please try again.",
        });
      }
    } catch (error) {
      console.error("handleBooking error:", error);
      setNotice({
        type: "error",
        message: "Something went wrong while creating the booking.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkAvailability = async () => {
    setNotice(null);

    if (!validateBookingInput()) return;

    try {
      setIsCheckingAvailability(true);

      const params = new URLSearchParams({
        roomId: selectedRoom,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      });

      const res = await fetch(
        `${API_BASE_URL}/api/bookings/availability?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) {
        setNotice({
          type: "error",
          message: "Could not check room availability.",
        });
        return;
      }

      const data = await res.json();

      if (data.available) {
        setNotice({
          type: "success",
          message: "The room is available during the selected time.",
        });
      } else {
        setNotice({
          type: "error",
          message: "The room is already occupied during the selected time.",
        });
      }
    } catch (err) {
      console.error("checkAvailability error:", err);
      setNotice({
        type: "error",
        message: "Could not check room availability.",
      });
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm">
          <h1 className="text-3xl font-bold">Book a room</h1>
          <p className="mt-2 text-sm text-blue-100">
            Search for a room, check availability and create a booking.
          </p>
        </div>

        {notice && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              notice.type === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : notice.type === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-blue-200 bg-blue-50 text-blue-800"
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

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-gray-900">
                  Search and filter
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Find the right room by name, type and capacity.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Search room
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search for room..."
                      className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Room type
                  </label>
                  <select
                    value={filterType}
                    onChange={(e) =>
                      setFilterType(e.target.value as RoomType | "all")
                    }
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="all">All types</option>
                    <option value="workspace">Workspace</option>
                    <option value="conference">Conference room</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Min. capacity
                  </label>
                  <select
                    value={filterCapacity}
                    onChange={(e) => setFilterCapacity(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="0">All</option>
                    <option value="1">1+</option>
                    <option value="4">4+</option>
                    <option value="8">8+</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {filteredRooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => {
                    const { start, end } = getDefaultBookingTimes();

                    setSelectedRoom(room.id);
                    setStartTime(start);
                    setEndTime(end);
                    setSelectedDate(startOfDay(new Date(start)));
                    setCurrentMonth(startOfMonth(new Date(start)));
                    setNotice(null);
                  }}
                  className={`overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                    selectedRoom === room.id
                      ? "border-blue-600 ring-2 ring-blue-100"
                      : "border-gray-100"
                  }`}
                >
                  <img
                    src={room.imageUrl}
                    alt={room.name}
                    className="h-48 w-full object-cover"
                  />

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {room.name}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600">
                          {room.description}
                        </p>
                      </div>

                      {selectedRoom === room.id && (
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                          Selected
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-700">
                      <div className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1.5">
                        <Users className="h-4 w-4" />
                        <span>
                          {room.capacity}{" "}
                          {room.capacity === 1 ? "person" : "persons"}
                        </span>
                      </div>

                      <div className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1.5">
                        <MapPin className="h-4 w-4" />
                        <span>
                          {room.type === "workspace"
                            ? "Workspace"
                            : "Conference room"}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {filteredRooms.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center shadow-sm">
                <Search className="mx-auto mb-4 h-14 w-14 text-gray-400" />
                <p className="text-lg font-medium text-gray-700">
                  No rooms match your filters
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Try adjusting your search, type or capacity.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Calendar overview
                  </h2>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className="rounded-xl border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className="rounded-xl border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div className="text-center">
                    <p className="text-base font-semibold text-gray-900">
                      {format(currentMonth, "MMMM yyyy")}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="rounded-xl border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="rounded-xl border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-3 grid grid-cols-7 gap-1.5">
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
                    const isCurrentMonth = isSameMonth(date, currentMonth);
                    const isPast = isBefore(date, today);
                    const hasBookings = hasAnyBookingOnDate(date);

                    let dayClasses =
                      "h-10 rounded-xl text-sm font-semibold transition-all ";

                    if (isSelected) {
                      dayClasses +=
                        "bg-blue-600 text-white shadow-sm hover:bg-blue-700";
                    } else if (!isCurrentMonth) {
                      dayClasses +=
                        "border border-gray-100 bg-gray-50 text-gray-300";
                    } else if (isPast) {
                      dayClasses +=
                        "cursor-not-allowed border border-gray-100 bg-gray-50 text-gray-400";
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
                        disabled={isPast}
                        className={dayClasses}
                      >
                        {format(date, "d")}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-gray-600">
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

              <div className="mt-5 border-t border-gray-100 pt-5">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">
                  Booked rooms on selected date
                </h3>

                {groupedBookingsForSelectedDate.length === 0 ? (
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-medium text-green-700">
                      No bookings on this date
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {groupedBookingsForSelectedDate.map((group) => (
                      <div
                        key={group.roomId}
                        className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-gray-900">
                              {group.roomName}
                            </p>
                            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-yellow-700">
                              Reserved times
                            </p>
                          </div>

                          <span className="rounded-full border border-yellow-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                            {group.slots.length}{" "}
                            {group.slots.length === 1 ? "booking" : "bookings"}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-col gap-2">
                          {group.slots.map((slot) => {
                            const orderedTimes = getOrderedTimes(
                              slot.start,
                              slot.end,
                            );

                            return (
                              <div
                                key={slot.id}
                                className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs"
                              >
                                <span className="font-medium text-gray-700">
                                  {orderedTimes.start} - {orderedTimes.end}
                                </span>

                                <span
                                  className={`rounded-full px-2.5 py-1 font-semibold ${
                                    slot.isOwnBooking
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  {slot.isOwnBooking
                                    ? "Your booking"
                                    : "Booked"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold text-gray-900">
                Booking details
              </h2>

              {selectedRoom ? (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-blue-50 p-4">
                    <p className="text-sm font-medium text-blue-900">
                      Selected room
                    </p>
                    <p className="mt-1 text-lg font-semibold text-blue-900">
                      {selectedRoomData?.name}
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      <Calendar className="mr-1 inline h-4 w-4" />
                      Start time
                    </label>
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => {
                        const nextStart = e.target.value;
                        setStartTime(nextStart);

                        if (nextStart) {
                          const nextEndDate = new Date(nextStart);
                          nextEndDate.setHours(nextEndDate.getHours() + 1);
                          setEndTime(formatForDateTimeLocal(nextEndDate));
                          setSelectedDate(startOfDay(new Date(nextStart)));
                          setCurrentMonth(startOfMonth(new Date(nextStart)));
                        }
                      }}
                      min={format(selectedDate, "yyyy-MM-dd'T'00:00")}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      <Clock className="mr-1 inline h-4 w-4" />
                      End time
                    </label>
                    <input
                      type="datetime-local"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      min={
                        startTime || format(selectedDate, "yyyy-MM-dd'T'00:00")
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <button
                    onClick={checkAvailability}
                    disabled={isCheckingAvailability}
                    className="w-full rounded-xl border border-blue-600 px-4 py-2.5 font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCheckingAvailability
                      ? "Checking availability..."
                      : "Check availability"}
                  </button>

                  <button
                    onClick={handleBooking}
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Creating booking..." : "Confirm booking"}
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center">
                  <DoorOpen className="mx-auto mb-3 h-12 w-12 text-gray-400" />
                  <p className="font-medium text-gray-700">
                    Select a room to start
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Then choose a time and create your booking.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}



