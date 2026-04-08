import { format } from "date-fns";

export function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatForDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function getDefaultBookingTimes(): { start: string; end: string } {
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

export function toTimestamp(value: string | Date | null | undefined): number {
  if (!value) return 0;
  return new Date(value).getTime();
}
