import { toTimestamp } from "./date";

export function getBookingCreatedTime(booking: { createdAt: string }): number {
  return toTimestamp(booking.createdAt);
}

export function getBookingUpdatedTime(booking: {
  createdAt: string;
  updatedAt?: string;
}): number {
  const updatedAt = booking.updatedAt ?? booking.createdAt;
  return toTimestamp(updatedAt);
}

export function getBookingLastActivityTime(booking: {
  createdAt: string;
  updatedAt?: string;
}): number {
  return Math.max(
    getBookingCreatedTime(booking),
    getBookingUpdatedTime(booking),
  );
}

export function sortByCreatedAtDesc<T extends { createdAt: string }>(
  items: T[],
): T[] {
  return [...items].sort(
    (a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt),
  );
}

export function sortByStartTimeAsc<T extends { startTime: string }>(
  items: T[],
): T[] {
  return [...items].sort(
    (a, b) => toTimestamp(a.startTime) - toTimestamp(b.startTime),
  );
}

export function isBookingPast(endTime: string): boolean {
  return toTimestamp(endTime) < Date.now();
}

export function isBookingUpcoming(startTime: string): boolean {
  return toTimestamp(startTime) > Date.now();
}

export function isUserNew(createdAt: string, windowHours = 24): boolean {
  const createdTime = toTimestamp(createdAt);

  if (Number.isNaN(createdTime)) return false;

  const diff = Date.now() - createdTime;
  return diff >= 0 && diff <= windowHours * 60 * 60 * 1000;
}

export function sortUsersWithNewFirst<
  T extends { createdAt: string; username: string },
>(users: T[]): T[] {
  return [...users].sort((a, b) => {
    const aIsNew = isUserNew(a.createdAt);
    const bIsNew = isUserNew(b.createdAt);

    if (aIsNew && !bIsNew) return -1;
    if (!aIsNew && bIsNew) return 1;

    if (aIsNew && bIsNew) {
      return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
    }

    return a.username.localeCompare(b.username, "sv");
  });
}

export function sortUsersByDeletedAtDesc<
  T extends { deletedAt?: string | null },
>(users: T[]): T[] {
  return [...users].sort(
    (a, b) =>
      toTimestamp(b.deletedAt ?? null) - toTimestamp(a.deletedAt ?? null),
  );
}
