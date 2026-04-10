const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const COOKIE_SESSION_TOKEN = "__cookie_session__";

function authHeaders(token: string) {
  if (!token || token === COOKIE_SESSION_TOKEN) {
    return {};
  }

  return { Authorization: `Bearer ${token}` };
}

type RoomWritePayload = {
  name?: string;
  capacity?: number;
  type?: string;
  description?: string;
  imageUrl?: string;
};

export function getRoomsApi(token: string): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/rooms`, {
    credentials: "include",
    headers: { ...authHeaders(token) },
  });
}

export function createRoomApi(
  token: string,
  payload: RoomWritePayload,
): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/rooms`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  });
}

export function updateRoomApi(
  token: string,
  id: string,
  payload: RoomWritePayload,
): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/rooms/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  });
}

export function deleteRoomApi(token: string, id: string): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/rooms/${id}`, {
    method: "DELETE",
    credentials: "include",
    headers: { ...authHeaders(token) },
  });
}
