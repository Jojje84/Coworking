import { Calendar, Clock, DoorOpen } from "lucide-react";
import { format, startOfDay, startOfMonth } from "date-fns";
import { Room } from "../../types";
import { formatForDateTimeLocal } from "../../../utils/date";

type BookingDetailsPanelProps = {
  selectedRoomId: string;
  selectedRoom?: Room;
  selectedDate: Date;
  startTime: string;
  endTime: string;
  isCheckingAvailability: boolean;
  isSubmitting: boolean;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onSelectedDateChange: (nextDate: Date) => void;
  onCurrentMonthChange: (nextMonth: Date) => void;
  onCheckAvailability: () => void;
  onConfirmBooking: () => void;
};

export function BookingDetailsPanel({
  selectedRoomId,
  selectedRoom,
  selectedDate,
  startTime,
  endTime,
  isCheckingAvailability,
  isSubmitting,
  onStartTimeChange,
  onEndTimeChange,
  onSelectedDateChange,
  onCurrentMonthChange,
  onCheckAvailability,
  onConfirmBooking,
}: BookingDetailsPanelProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">
        Booking details
      </h2>

      {selectedRoomId ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900">Selected room</p>
            <p className="mt-1 text-lg font-semibold text-blue-900">
              {selectedRoom?.name}
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
                onStartTimeChange(nextStart);

                if (nextStart) {
                  const nextEndDate = new Date(nextStart);
                  nextEndDate.setHours(nextEndDate.getHours() + 1);
                  onEndTimeChange(formatForDateTimeLocal(nextEndDate));
                  onSelectedDateChange(startOfDay(new Date(nextStart)));
                  onCurrentMonthChange(startOfMonth(new Date(nextStart)));
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
              onChange={(e) => onEndTimeChange(e.target.value)}
              min={startTime || format(selectedDate, "yyyy-MM-dd'T'00:00")}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <button
            onClick={onCheckAvailability}
            disabled={isCheckingAvailability}
            className="w-full rounded-xl border border-blue-600 px-4 py-2.5 font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCheckingAvailability
              ? "Checking availability..."
              : "Check availability"}
          </button>

          <button
            onClick={onConfirmBooking}
            disabled={isSubmitting}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creating booking..." : "Confirm booking"}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center">
          <DoorOpen className="mx-auto mb-3 h-12 w-12 text-gray-400" />
          <p className="font-medium text-gray-700">Select a room to start</p>
          <p className="mt-1 text-sm text-gray-500">
            Then choose a time and create your booking.
          </p>
        </div>
      )}
    </div>
  );
}
