// ─────────────────────────────────────────
// Admin Users
// ─────────────────────────────────────────

import React, { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";
import * as Dialog from "@radix-ui/react-dialog";
import { UserPermissions } from "../types";
import {
  Users as UsersIcon,
  Mail,
  Trash2,
  Calendar,
  Plus,
  X,
  Shield,
  Lock,
  Pencil,
  CheckCircle2,
  AlertCircle,
  UserRound,
  RotateCcw,
} from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { sv } from "date-fns/locale";

type UserFormData = {
  username: string;
  email: string;
  password: string;
  role: "user" | "admin";
  permissions: Required<UserPermissions>;
};

type AppUser = {
  id: string;
  username: string;
  email: string;
  role: "user" | "admin";
  permissions?: UserPermissions;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deleteAfter?: string | null;
  createdAt: string;
};

type NoticeState = {
  type: "success" | "error";
  message: string;
} | null;

type ViewFilter = "active" | "deleted" | "all";

type StatCardProps = {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
};

type UserDialogProps = {
  isOpen: boolean;
  isEditMode: boolean;
  canManagePermissions: boolean;
  onClose: () => void;
  onSave: () => void;
  formData: UserFormData;
  setFormData: React.Dispatch<React.SetStateAction<UserFormData>>;
};

type UserTableProps = {
  title: string;
  description: string;
  users: AppUser[];
  getUserBookingsCount?: (userId: string) => number;
  onEdit: (userId: string) => void;
  onDelete: (userId: string) => void;
  canDeleteUser?: (user: AppUser) => boolean;
};

const NEW_USER_HOURS = 24;

function defaultPermissions(): Required<UserPermissions> {
  return {
    bookingHardDelete: false,
    userHardDelete: false,
    manageAdmins: false,
    manageSettings: false,
    viewAuditLogs: false,
  };
}

const ADMIN_PERMISSION_OPTIONS: Array<{
  key: keyof Required<UserPermissions>;
  label: string;
}> = [
  {
    key: "bookingHardDelete",
    label: "Allow permanent booking delete",
  },
  {
    key: "userHardDelete",
    label: "Allow permanent user delete",
  },
  {
    key: "manageAdmins",
    label: "Allow managing admin permissions",
  },
  {
    key: "manageSettings",
    label: "Allow managing system settings",
  },
  {
    key: "viewAuditLogs",
    label: "Allow viewing audit logs",
  },
];

function isUserNew(createdAt: string) {
  const createdTime = new Date(createdAt).getTime();

  if (Number.isNaN(createdTime)) return false;

  const diff = Date.now() - createdTime;
  return diff >= 0 && diff <= NEW_USER_HOURS * 60 * 60 * 1000;
}

function isSuperadminUser(user: AppUser) {
  if (user.role !== "admin") return false;

  return Boolean(
    user.permissions?.bookingHardDelete ||
      user.permissions?.userHardDelete ||
      user.permissions?.manageAdmins ||
      user.permissions?.manageSettings ||
      user.permissions?.viewAuditLogs,
  );
}

function sortUsersWithNewFirst(users: AppUser[]) {
  return [...users].sort((a, b) => {
    const aIsNew = isUserNew(a.createdAt);
    const bIsNew = isUserNew(b.createdAt);

    if (aIsNew && !bIsNew) return -1;
    if (!aIsNew && bIsNew) return 1;

    if (aIsNew && bIsNew) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }

    return a.username.localeCompare(b.username, "sv");
  });
}

function StatCard({ title, value, subtitle, icon }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            {value}
          </p>
          <p className="mt-2 text-sm text-gray-500">{subtitle}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-700">
          {icon}
        </div>
      </div>
    </div>
  );
}

function UserDialog({
  isOpen,
  isEditMode,
  canManagePermissions,
  onClose,
  onSave,
  formData,
  setFormData,
}: UserDialogProps) {
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <Dialog.Title className="text-xl font-semibold text-gray-900">
                {isEditMode ? "Edit user" : "Add new user"}
              </Dialog.Title>
              <p className="mt-1 text-sm text-gray-500">
                {isEditMode
                  ? "Update account details and permissions"
                  : "Create a new account in the system"}
              </p>
            </div>

            <Dialog.Close className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, username: e.target.value }))
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="e.g. anna"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, email: e.target.value }))
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="anna@example.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Password{" "}
                {isEditMode && (
                  <span className="text-gray-400">(optional)</span>
                )}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, password: e.target.value }))
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder={
                  isEditMode
                    ? "Leave blank to keep current password"
                    : "Minimum 6 characters"
                }
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    role: e.target.value as "user" | "admin",
                    permissions:
                      e.target.value === "admin"
                        ? p.permissions
                        : defaultPermissions(),
                  }))
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {formData.role === "admin" && (
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-medium text-amber-900">
                  Admin permissions
                </p>
                {!canManagePermissions && (
                  <p className="text-xs text-amber-800">
                    You can view permissions, but only superadmins can change them.
                  </p>
                )}
                {ADMIN_PERMISSION_OPTIONS.map((option) => (
                  <label
                    key={option.key}
                    className="flex cursor-pointer items-start gap-3"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(formData.permissions[option.key])}
                      disabled={!canManagePermissions}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          permissions: {
                            ...p.permissions,
                            [option.key]: e.target.checked,
                          },
                        }))
                      }
                      className="mt-1 h-4 w-4"
                    />
                    <span className="text-sm text-amber-900">{option.label}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 font-medium transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700"
              >
                {isEditMode ? "Save changes" : "Create user"}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function UserTable({
  title,
  description,
  users,
  getUserBookingsCount,
  onEdit,
  onDelete,
  canDeleteUser,
}: UserTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-5">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      {users.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <UserRound className="h-7 w-7 text-gray-400" />
          </div>
          <p className="mt-4 text-base font-medium text-gray-700">
            No users in this group
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  User
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Role
                </th>
                {getUserBookingsCount && (
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Active bookings
                  </th>
                )}
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Registered
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 bg-white">
              {users.map((user) => {
                const canDelete = canDeleteUser ? canDeleteUser(user) : true;
                const isNew = isUserNew(user.createdAt);

                return (
                  <tr key={user.id} className="hover:bg-gray-50/80">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                          <UsersIcon className="h-5 w-5 text-blue-600" />
                        </div>

                        <div className="ml-4">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-gray-900">
                              {user.username}
                            </div>

                            {isNew && (
                              <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                                New
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="mr-2 h-4 w-4" />
                        {user.email}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            user.role === "admin"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {user.role === "admin" ? "Admin" : "User"}
                        </span>
                        {user.role === "admin" &&
                          (user.permissions?.bookingHardDelete ||
                            user.permissions?.userHardDelete ||
                            user.permissions?.manageAdmins ||
                            user.permissions?.manageSettings ||
                            user.permissions?.viewAuditLogs) && (
                            <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                              Superadmin
                            </span>
                          )}
                      </div>
                    </td>

                    {getUserBookingsCount && (
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="mr-2 h-4 w-4" />
                          {getUserBookingsCount(user.id)}
                        </div>
                      </td>
                    )}

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {format(new Date(user.createdAt), "PP", { locale: sv })}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onEdit(user.id)}
                          className="flex items-center gap-2 rounded-xl px-3 py-2 text-blue-600 transition-colors hover:bg-blue-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        {canDelete && (
                          <button
                            onClick={() => onDelete(user.id)}
                            className="flex items-center gap-2 rounded-xl px-3 py-2 text-red-600 transition-colors hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AdminUsers() {
  const { user: currentUser } = useAuth();
  const {
    users,
    bookings,
    deleteUser,
    restoreUser,
    hardDeleteUser,
    addUser,
    updateUser,
  } = useData();
  const canManageAdminPermissions = Boolean(
    currentUser?.permissions?.manageAdmins,
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<AppUser | null>(null);
  const [hardDeletingUser, setHardDeletingUser] = useState<AppUser | null>(null);
  const [hardDeleteConfirmText, setHardDeleteConfirmText] = useState("");
  const [isHardDeleting, setIsHardDeleting] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const canHardDeleteUsers = Boolean(currentUser?.permissions?.userHardDelete);

  const [formData, setFormData] = useState<UserFormData>({
    username: "",
    email: "",
    password: "",
    role: "user",
    permissions: defaultPermissions(),
  });

  const isEditMode = editingUserId !== null;

  const resetForm = () => {
    setFormData({
      username: "",
      email: "",
      password: "",
      role: "user",
      permissions: defaultPermissions(),
    });
    setEditingUserId(null);
  };

  const handleOpenAdd = () => {
    setNotice(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (userId: string) => {
    setNotice(null);
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    setEditingUserId(userId);
    setFormData({
      username: user.username,
      email: user.email,
      password: "",
      role: user.role,
      permissions: {
        bookingHardDelete: Boolean(user.permissions?.bookingHardDelete),
        userHardDelete: Boolean(user.permissions?.userHardDelete),
        manageAdmins: Boolean(user.permissions?.manageAdmins),
        manageSettings: Boolean(user.permissions?.manageSettings),
        viewAuditLogs: Boolean(user.permissions?.viewAuditLogs),
      },
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setNotice(null);

    if (!formData.username.trim() || !formData.email.trim()) {
      setNotice({
        type: "error",
        message: "Username and email are required.",
      });
      return;
    }

    if (!isEditMode && !formData.password) {
      setNotice({
        type: "error",
        message: "Password is required when creating a user.",
      });
      return;
    }

    if (formData.password && formData.password.length < 6) {
      setNotice({
        type: "error",
        message: "Password must be at least 6 characters.",
      });
      return;
    }

    let success = false;

    if (isEditMode && editingUserId) {
      success = await updateUser(editingUserId, {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password || undefined,
        role: formData.role,
        permissions:
          canManageAdminPermissions
            ? formData.role === "admin"
              ? formData.permissions
              : defaultPermissions()
            : undefined,
      });
    } else {
      success = await addUser({
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
        permissions:
          canManageAdminPermissions
            ? formData.role === "admin"
              ? formData.permissions
              : defaultPermissions()
            : undefined,
      });
    }

    if (success) {
      setNotice({
        type: "success",
        message: isEditMode
          ? "User updated successfully."
          : "User created successfully.",
      });
      setIsDialogOpen(false);
      resetForm();
    } else {
      setNotice({
        type: "error",
        message: "Could not save user. Please try again.",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;

    if (deletingUser.id === currentUser?.id) {
      setNotice({
        type: "error",
        message: "You cannot delete your own admin account.",
      });
      setDeletingUser(null);
      return;
    }

    const success = await deleteUser(deletingUser.id);

    if (success) {
      setNotice({
        type: "success",
        message: `"${deletingUser.username}" was removed successfully.`,
      });
    } else {
      setNotice({
        type: "error",
        message: "Could not delete user.",
      });
    }

    setDeletingUser(null);
  };

  const getUserBookingsCount = (userId: string) => {
    return bookings.filter((b) => b.userId === userId && b.status === "active")
      .length;
  };

  const sortedAdmins = useMemo(() => {
    return sortUsersWithNewFirst(
      users.filter((user) => !user.isDeleted && user.role === "admin"),
    );
  }, [users]);

  const sortedRegularUsers = useMemo(() => {
    return sortUsersWithNewFirst(
      users.filter((user) => !user.isDeleted && user.role === "user"),
    );
  }, [users]);

  const sortedDeletedUsers = useMemo(() => {
    return [...users]
      .filter((user) => user.isDeleted)
      .sort((a, b) => {
        const aDeleted = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
        const bDeleted = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
        return bDeleted - aDeleted;
      });
  }, [users]);

  const newUsersCount = useMemo(() => {
    return users.filter((user) => !user.isDeleted && isUserNew(user.createdAt))
      .length;
  }, [users]);

  const showActiveSections = viewFilter === "all" || viewFilter === "active";
  const showDeletedSection = viewFilter === "all" || viewFilter === "deleted";

  return (
    <Layout>
      <div className="space-y-8">
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold">User Management</h1>
              <p className="mt-2 text-sm text-gray-300">
                Manage admins and regular users in the system.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex rounded-xl border border-white/30 bg-white/10 p-1">
                <button
                  onClick={() => setViewFilter("all")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewFilter === "all"
                      ? "bg-white text-slate-900"
                      : "text-white/90 hover:bg-white/15"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setViewFilter("active")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewFilter === "active"
                      ? "bg-white text-slate-900"
                      : "text-white/90 hover:bg-white/15"
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setViewFilter("deleted")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewFilter === "deleted"
                      ? "bg-white text-slate-900"
                      : "text-white/90 hover:bg-white/15"
                  }`}
                >
                  Deleted
                </button>
              </div>

              <button
                onClick={handleOpenAdd}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 font-medium text-slate-900 transition-colors hover:bg-gray-100"
              >
                <Plus className="h-5 w-5" />
                Add user
              </button>
            </div>
          </div>
        </div>

        {notice && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              notice.type === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {notice.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <span>{notice.message}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
          <StatCard
            title="Total users"
            value={users.filter((u) => !u.isDeleted).length}
            subtitle="Active accounts in the system"
            icon={<UsersIcon className="h-6 w-6 text-blue-600" />}
          />
          <StatCard
            title="Admins"
            value={sortedAdmins.length}
            subtitle="Users with elevated permissions"
            icon={<Shield className="h-6 w-6 text-purple-600" />}
          />
          <StatCard
            title="Regular users"
            value={sortedRegularUsers.length}
            subtitle="Standard booking accounts"
            icon={<Lock className="h-6 w-6 text-green-600" />}
          />
          <StatCard
            title="New users"
            value={newUsersCount}
            subtitle={`Registered in last ${NEW_USER_HOURS} hours`}
            icon={<UserRound className="h-6 w-6 text-orange-600" />}
          />
          <StatCard
            title="Soft deleted"
            value={sortedDeletedUsers.length}
            subtitle="Can be restored during grace period"
            icon={<Trash2 className="h-6 w-6 text-red-600" />}
          />
        </div>

        {showActiveSections && (
          <>
            <UserTable
              title="Admins"
              description="System admins with elevated permissions"
              users={sortedAdmins}
              onEdit={handleOpenEdit}
              onDelete={(userId) => {
                const user = users.find((u) => u.id === userId);
                if (!user) return;

                if (user.id === currentUser?.id) {
                  setNotice({
                    type: "error",
                    message: "You cannot delete your own admin account.",
                  });
                  return;
                }

                if (isSuperadminUser(user)) {
                  setNotice({
                    type: "error",
                    message: "Superadmin accounts cannot be deleted.",
                  });
                  return;
                }

                setNotice(null);
                setDeletingUser(user);
              }}
              canDeleteUser={(user) =>
                user.id !== currentUser?.id && !isSuperadminUser(user)
              }
            />

            <UserTable
              title="Users"
              description="Regular users of the booking platform"
              users={sortedRegularUsers}
              getUserBookingsCount={getUserBookingsCount}
              onEdit={handleOpenEdit}
              onDelete={(userId) => {
                const user = users.find((u) => u.id === userId);
                if (!user) return;

                setNotice(null);
                setDeletingUser(user);
              }}
              canDeleteUser={() => true}
            />
          </>
        )}

        {showDeletedSection && (
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-5">
            <h2 className="text-xl font-semibold text-gray-900">
              Soft deleted users
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              These users are inactive and can be restored before grace period
              expires.
            </p>
          </div>

          {sortedDeletedUsers.length === 0 ? (
            <div className="px-6 py-10 text-sm text-gray-500">
              No soft deleted users.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      User
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Deleted at
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Purge after
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {sortedDeletedUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50/80">
                      <td className="px-6 py-4 text-sm text-gray-800">
                        <div className="font-medium">{user.username}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {user.deletedAt
                          ? format(new Date(user.deletedAt), "PPp", {
                              locale: sv,
                            })
                          : "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {user.deleteAfter ? (
                          <div className="space-y-1">
                            <div>
                              {format(new Date(user.deleteAfter), "PPp", {
                                locale: sv,
                              })}
                            </div>
                            <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                              {Math.max(
                                0,
                                differenceInCalendarDays(
                                  new Date(user.deleteAfter),
                                  new Date(),
                                ),
                              )} day(s) left
                            </span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              const success = await restoreUser(user.id);
                              if (success) {
                                setNotice({
                                  type: "success",
                                  message: `"${user.username}" was restored successfully.`,
                                });
                              } else {
                                setNotice({
                                  type: "error",
                                  message: `Could not restore "${user.username}".`,
                                });
                              }
                            }}
                            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-blue-600 transition-colors hover:bg-blue-50"
                          >
                            <RotateCcw className="h-4 w-4" />
                            Restore
                          </button>

                          {canHardDeleteUsers && !isSuperadminUser(user) && (
                            <button
                              onClick={() => {
                                setHardDeleteConfirmText("");
                                setHardDeletingUser(user);
                              }}
                              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-red-700 transition-colors hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete permanently
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}
      </div>

      <UserDialog
        isOpen={isDialogOpen}
        isEditMode={isEditMode}
        canManagePermissions={canManageAdminPermissions}
        onClose={() => {
          setIsDialogOpen(false);
          resetForm();
        }}
        onSave={handleSave}
        formData={formData}
        setFormData={setFormData}
      />

      <Dialog.Root
        open={!!deletingUser}
        onOpenChange={(open) => {
          if (!open) setDeletingUser(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>

              <div className="flex-1">
                <Dialog.Title className="text-lg font-semibold text-gray-900">
                  Delete user
                </Dialog.Title>
                <p className="mt-1 text-sm text-gray-600">
                  Are you sure you want to remove{" "}
                  <span className="font-semibold text-gray-900">
                    {deletingUser?.username}
                  </span>
                  ? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 font-medium transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-red-700"
              >
                Delete user
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={!!hardDeletingUser}
        onOpenChange={(open) => {
          if (!open) {
            setHardDeletingUser(null);
            setHardDeleteConfirmText("");
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>

              <div className="flex-1">
                <Dialog.Title className="text-lg font-semibold text-gray-900">
                  Delete user permanently
                </Dialog.Title>
                <p className="mt-1 text-sm text-gray-600">
                  This will permanently remove
                  {" "}
                  <span className="font-semibold text-gray-900">
                    {hardDeletingUser?.username}
                  </span>
                  . Type DELETE to confirm.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Confirmation text
              </label>
              <input
                type="text"
                value={hardDeleteConfirmText}
                onChange={(e) => setHardDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setHardDeletingUser(null);
                  setHardDeleteConfirmText("");
                }}
                disabled={isHardDeleting}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 font-medium transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!hardDeletingUser) return;

                  try {
                    setIsHardDeleting(true);
                    const success = await hardDeleteUser(
                      hardDeletingUser.id,
                      hardDeleteConfirmText.trim(),
                    );

                    if (success) {
                      setNotice({
                        type: "success",
                        message: `"${hardDeletingUser.username}" was permanently deleted.`,
                      });
                      setHardDeletingUser(null);
                      setHardDeleteConfirmText("");
                    }
                  } finally {
                    setIsHardDeleting(false);
                  }
                }}
                disabled={
                  isHardDeleting || hardDeleteConfirmText.trim() !== "DELETE"
                }
                className="flex-1 rounded-xl bg-red-700 px-4 py-2.5 font-medium text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isHardDeleting ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Layout>
  );
}
