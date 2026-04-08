export function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

export function isValidDate(value) {
  const date = toDate(value);
  return !Number.isNaN(date.getTime());
}

export function isRangeOverlap(startA, endA, startB, endB) {
  const aStart = toDate(startA).getTime();
  const aEnd = toDate(endA).getTime();
  const bStart = toDate(startB).getTime();
  const bEnd = toDate(endB).getTime();

  return aStart < bEnd && aEnd > bStart;
}

export function subtractDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}
