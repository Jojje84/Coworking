// ─────────────────────────────────────────
// Layout
// ─────────────────────────────────────────

import { Link, useNavigate, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";
import {
  Home,
  Calendar,
  PlusCircle,
  Users,
  DoorOpen,
  LogOut,
  Menu,
  X,
  UserCircle2,
  Settings,
  ShieldCheck,
  Megaphone,
} from "lucide-react";
import { useState } from "react";
import { ProfileModal } from "./ProfileModal";
import { useSettings } from "../context/SettingsContext";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { adminAnnouncement, userAnnouncement } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  // const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path: string) => location.pathname === path;

  const userLinks = [
    { path: "/", label: "Dashboard", icon: Home },
    { path: "/bookings", label: "My Bookings", icon: Calendar },
    { path: "/book-room", label: "Book Room", icon: PlusCircle },
  ];

  const adminLinks = [
    { path: "/", label: "Dashboard", icon: Home },
    { path: "/admin/rooms", label: "Room Management", icon: DoorOpen },
    { path: "/admin/users", label: "User Management", icon: Users },
    { path: "/admin/bookings", label: "All Bookings", icon: Calendar },
    ...(user?.permissions?.manageSettings
      ? [{ path: "/admin/settings", label: "System Settings", icon: Settings }]
      : []),
    ...(user?.permissions?.viewAuditLogs
      ? [{ path: "/admin/audit-logs", label: "Audit Logs", icon: ShieldCheck }]
      : []),
  ];

  const links = user?.role === "admin" ? adminLinks : userLinks;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <DoorOpen className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">
              CoWork Space
            </span>
          </div>

          <div className="hidden md:flex w-full items-center">
            <div className="flex flex-nowrap items-center flex-1 min-w-0 gap-0">
              {links.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors whitespace-normal break-words ${
                      isActive(link.path)
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-0 pl-0 bg-white flex-shrink-0">
              <button
                type="button"
                onClick={() => setProfileModalOpen(true)}
                className="group flex items-center gap-0 rounded-xl border border-gray-200 bg-white px-1 py-1 text-left shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50/60 hover:shadow cursor-pointer"
                aria-label="Open profile settings"
                title="Redigera profil"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100">
                  <UserCircle2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="text-sm font-semibold text-gray-900 whitespace-normal break-words">
                    {user?.username}
                  </div>
                  <div className="text-xs text-gray-500 whitespace-normal break-words">
                    {user?.role === "admin" ? "Admin" : "User"} · Redigera
                    profil
                  </div>
                </div>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-md px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Logga ut
              </button>
            </div>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-md p-2 text-gray-700 hover:bg-gray-100 md:hidden"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-gray-200 bg-white md:hidden">
            <div className="space-y-1 px-4 py-3">
              {links.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                      isActive(link.path)
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}

              <div className="border-t border-gray-200 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setProfileModalOpen(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 text-left shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50/60"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <UserCircle2 className="h-6 w-6" />
                  </div>

                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="text-sm font-semibold text-gray-900 whitespace-normal break-words">
                      {user?.username}
                    </div>
                    <div className="text-xs text-gray-500 whitespace-normal break-words">
                      {user?.role === "admin" ? "Admin" : "User"} · Redigera
                      profil
                    </div>
                  </div>
                </button>
                <button
                  onClick={handleLogout}
                  className="mt-3 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Logga ut
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {user?.role === "admin" && adminAnnouncement && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm">
            <div className="flex items-start gap-3">
              <Megaphone className="mt-0.5 h-5 w-5" />
              <div>
                <p className="text-sm font-semibold">Admin announcement</p>
                <p className="mt-1 text-sm leading-6">{adminAnnouncement}</p>
              </div>
            </div>
          </div>
        )}
        {user?.role === "user" && userAnnouncement && (
          <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900 shadow-sm">
            <div className="flex items-start gap-3">
              <Megaphone className="mt-0.5 h-5 w-5" />
              <div>
                <p className="text-sm font-semibold">User announcement</p>
                <p className="mt-1 text-sm leading-6">{userAnnouncement}</p>
              </div>
            </div>
          </div>
        )}
        {children}
      </main>

      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </div>
  );
}
