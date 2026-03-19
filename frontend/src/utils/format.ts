import { format } from "date-fns";

export function toTimeLabel(iso: string): string {
  return format(new Date(iso), "HH:mm");
}

export function getOrderedTimes(
  startIso: string,
  endIso: string,
): { start: string; end: string } {
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
