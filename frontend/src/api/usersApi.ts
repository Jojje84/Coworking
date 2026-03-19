const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const COOKIE_SESSION_TOKEN = "__cookie_session__";

function authHeaders(token: string) {
  if (!token || token === COOKIE_SESSION_TOKEN) {
    return {};
  }

  return { Authorization: `Bearer ${token}` };
}

type UserWritePayload = {
  username?: string;
  email?: string;
  password?: string;
  role?: "Admin" | "User";
  permissions?: {
    bookingHardDelete: boolean;
    userHardDelete: boolean;
    manageAdmins: boolean;
    manageSettings: boolean;
    viewAuditLogs: boolean;
  };
};

export function getUsersApi(
  token: string,
  includeDeleted = true,
): Promise<Response> {
  return fetch(
    `${API_BASE_URL}/api/users?includeDeleted=${String(includeDeleted)}`,
    {
      credentials: "include",
      headers: { ...authHeaders(token) },
    },
  );
}

export function createUserApi(
  token: string,
  payload: UserWritePayload,
): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/users`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  });
}

export function updateUserApi(
  token: string,
  id: string,
  payload: UserWritePayload,
): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/users/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  });
}

export function deleteUserApi(token: string, id: string): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/users/${id}`, {
    method: "DELETE",
    credentials: "include",
    headers: { ...authHeaders(token) },
  });
}

export function restoreUserApi(token: string, id: string): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/users/${id}/restore`, {
    method: "POST",
    credentials: "include",
    headers: { ...authHeaders(token) },
  });
}

export function hardDeleteUserApi(
  token: string,
  id: string,
  confirmText: string,
): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/users/${id}/hard`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ confirmText }),
  });
}
