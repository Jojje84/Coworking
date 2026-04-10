const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const COOKIE_SESSION_TOKEN = "__cookie_session__";

function authHeaders(token: string) {
  if (!token || token === COOKIE_SESSION_TOKEN) {
    return {};
  }

  return { Authorization: `Bearer ${token}` };
}

type BookingWritePayload = {
  roomId?: string;
  startTime?: string;
  endTime?: string;
  status?: "active" | "completed" | "cancelled";
};

export function getBookingsApi(token: string): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/bookings`, {
    credentials: "include",
    headers: { ...authHeaders(token) },
  });
}

export function getCalendarBookingsApi(
  token: string,
  start: string,
  end: string,
): Promise<Response> {
  const params = new URLSearchParams({ start, end });
  return fetch(`${API_BASE_URL}/api/bookings/calendar?${params.toString()}`, {
    credentials: "include",
    headers: { ...authHeaders(token) },
  });
}

export function createBookingApi(
  token: string,
  payload: BookingWritePayload,
): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/bookings`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  });
}

export function updateBookingApi(
  token: string,
  id: string,
  payload: BookingWritePayload,
): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/bookings/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  });
}

export function deleteBookingApi(token: string, id: string): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/bookings/${id}`, {
    method: "DELETE",
    credentials: "include",
    headers: { ...authHeaders(token) },
  });
}

export function hardDeleteBookingApi(
  token: string,
  id: string,
  confirmText: string,
): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/bookings/${id}/hard`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ confirmText }),
  });
}

export function checkBookingAvailabilityApi(
  token: string,
  roomId: string,
  startTime: string,
  endTime: string,
): Promise<Response> {
  const params = new URLSearchParams({
    roomId,
    startTime,
    endTime,
  });

  return fetch(
    `${API_BASE_URL}/api/bookings/availability?${params.toString()}`,
    {
      credentials: "include",
      headers: { ...authHeaders(token) },
    },
  );
}
