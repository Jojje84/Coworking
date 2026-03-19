const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
export const COOKIE_SESSION_TOKEN = "__cookie_session__";

type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = {
  username: string;
  email: string;
  password: string;
};

type UpdateProfilePayload = {
  username?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
};

function authHeaders(token?: string): HeadersInit {
  if (!token || token === COOKIE_SESSION_TOKEN) {
    return {};
  }

  return { Authorization: `Bearer ${token}` };
}

export function loginApi(payload: LoginPayload): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
}

export function registerApi(payload: RegisterPayload): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
}

export function getSessionApi(token?: string): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/auth/me`, {
    method: "GET",
    credentials: "include",
    headers: { ...authHeaders(token) },
  });
}

export function logoutApi(token?: string): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: { ...authHeaders(token) },
  });
}

export function updateProfileApi(
  token: string,
  payload: UpdateProfilePayload,
): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/users/me`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  });
}
