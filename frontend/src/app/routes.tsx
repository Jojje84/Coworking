// ─────────────────────────────────────────
// Routes
// ─────────────────────────────────────────

import { createBrowserRouter, Navigate } from "react-router";
import { ReactNode, Suspense, lazy } from "react";
import { useAuth } from "./context/AuthContext";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { MyBookings } from "./pages/MyBookings";
import { BookRoom } from "./pages/BookRoom";

const DashboardPage = lazy(async () => {
  const mod = await import("./pages/Dashboard");
  return { default: mod.Dashboard };
});

const AdminRoomsPage = lazy(async () => {
  const mod = await import("./pages/AdminRooms");
  return { default: mod.AdminRooms };
});

const AdminUsersPage = lazy(async () => {
  const mod = await import("./pages/AdminUsers");
  return { default: mod.AdminUsers };
});

const AdminBookingsPage = lazy(async () => {
  const mod = await import("./pages/AdminBookings");
  return { default: mod.AdminBookings };
});

const AdminSettingsPage = lazy(async () => {
  const mod = await import("./pages/AdminSettings");
  return { default: mod.AdminSettings };
});

const AdminAuditLogsPage = lazy(async () => {
  const mod = await import("./pages/AdminAuditLogs");
  return { default: mod.AdminAuditLogs };
});

function RouteLoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Loading page...
        </div>
      </div>
    </div>
  );
}

function withPageSuspense(children: ReactNode) {
  return <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
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
  children: ReactNode;
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
      <ProtectedRoute>{withPageSuspense(<DashboardPage />)}</ProtectedRoute>
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
    element: <AdminRoute>{withPageSuspense(<AdminRoomsPage />)}</AdminRoute>,
  },
  {
    path: "/admin/users",
    element: <AdminRoute>{withPageSuspense(<AdminUsersPage />)}</AdminRoute>,
  },
  {
    path: "/admin/bookings",
    element: <AdminRoute>{withPageSuspense(<AdminBookingsPage />)}</AdminRoute>,
  },
  {
    path: "/admin/settings",
    element: (
      <AdminPermissionRoute permission="manageSettings">
        {withPageSuspense(<AdminSettingsPage />)}
      </AdminPermissionRoute>
    ),
  },
  {
    path: "/admin/audit-logs",
    element: (
      <AdminPermissionRoute permission="viewAuditLogs">
        {withPageSuspense(<AdminAuditLogsPage />)}
      </AdminPermissionRoute>
    ),
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
