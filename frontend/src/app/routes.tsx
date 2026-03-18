// ─────────────────────────────────────────
// Routes
// ─────────────────────────────────────────

import { createBrowserRouter, Navigate } from "react-router";
import { useAuth } from "./context/AuthContext";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { MyBookings } from "./pages/MyBookings";
import { BookRoom } from "./pages/BookRoom";
import { AdminRooms } from "./pages/AdminRooms";
import { AdminUsers } from "./pages/AdminUsers";
import { AdminBookings } from "./pages/AdminBookings";
import { AdminSettings } from "./pages/AdminSettings";
import { AdminAuditLogs } from "./pages/AdminAuditLogs";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AdminPermissionRoute({
  permission,
  children,
}: {
  permission: "manageSettings" | "viewAuditLogs";
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  if (!user.permissions?.[permission]) {
    return <Navigate to="/admin/bookings" replace />;
  }

  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/register",
    element: <Register />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/bookings",
    element: (
      <ProtectedRoute>
        <MyBookings />
      </ProtectedRoute>
    ),
  },
  {
    path: "/book-room",
    element: (
      <ProtectedRoute>
        <BookRoom />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/rooms",
    element: (
      <AdminRoute>
        <AdminRooms />
      </AdminRoute>
    ),
  },
  {
    path: "/admin/users",
    element: (
      <AdminRoute>
        <AdminUsers />
      </AdminRoute>
    ),
  },
  {
    path: "/admin/bookings",
    element: (
      <AdminRoute>
        <AdminBookings />
      </AdminRoute>
    ),
  },
  {
    path: "/admin/settings",
    element: (
      <AdminPermissionRoute permission="manageSettings">
        <AdminSettings />
      </AdminPermissionRoute>
    ),
  },
  {
    path: "/admin/audit-logs",
    element: (
      <AdminPermissionRoute permission="viewAuditLogs">
        <AdminAuditLogs />
      </AdminPermissionRoute>
    ),
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
