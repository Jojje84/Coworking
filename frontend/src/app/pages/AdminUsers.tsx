import React, { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useUsers } from "../context/UsersContext";
import { useBookings } from "../context/BookingsContext";
import { Layout } from "../components/Layout";
import {
  AppUser,
  defaultPermissions,
  DeleteUserDialog,
  DeletedUsersSection,
  HardDeleteUserDialog,
  isSuperadminUser,
  NEW_USER_HOURS,
  NoticeState,
  UserDialog,
  UserFormData,
  UserStatsGrid,
  UserTable,
  ViewFilter,
  AdminUsersHeader,
  NoticeBanner,
} from "../components/users/AdminUsersSections";
import {
  isUserNew,
  sortUsersByDeletedAtDesc,
  sortUsersWithNewFirst,
} from "../../utils/booking";

export function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { bookings } = useBookings();
  const {
    users,
    deleteUser,
    restoreUser,
    hardDeleteUser,
    addUser,
    updateUser,
  } = useUsers();

  const canManageAdminPermissions = Boolean(
    currentUser?.permissions?.manageAdmins,
  );
  const canHardDeleteUsers = Boolean(currentUser?.permissions?.userHardDelete);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<AppUser | null>(null);
  const [hardDeletingUser, setHardDeletingUser] = useState<AppUser | null>(
    null,
  );
  const [hardDeleteConfirmText, setHardDeleteConfirmText] = useState("");
  const [isHardDeleting, setIsHardDeleting] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");

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
        permissions: canManageAdminPermissions
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
        permissions: canManageAdminPermissions
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

  const handleRestoreDeletedUser = async (user: AppUser) => {
    const success = await restoreUser(user.id);
    if (success) {
      setNotice({
        type: "success",
        message: `"${user.username}" was restored successfully.`,
      });
      return;
    }

    setNotice({
      type: "error",
      message: `Could not restore "${user.username}".`,
    });
  };

  const handleHardDeleteUser = async () => {
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
    return sortUsersByDeletedAtDesc(users.filter((user) => user.isDeleted));
  }, [users]);

  const newUsersCount = useMemo(() => {
    return users.filter(
      (user) => !user.isDeleted && isUserNew(user.createdAt, NEW_USER_HOURS),
    ).length;
  }, [users]);

  const showActiveSections = viewFilter === "all" || viewFilter === "active";
  const showDeletedSection = viewFilter === "all" || viewFilter === "deleted";

  return (
    <Layout>
      <div className="space-y-8">
        <AdminUsersHeader
          viewFilter={viewFilter}
          onViewFilterChange={setViewFilter}
          onAddUser={handleOpenAdd}
        />

        <NoticeBanner notice={notice} />

        <UserStatsGrid
          totalUsers={users.filter((u) => !u.isDeleted).length}
          adminsCount={sortedAdmins.length}
          regularUsersCount={sortedRegularUsers.length}
          newUsersCount={newUsersCount}
          deletedUsersCount={sortedDeletedUsers.length}
        />

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
          <DeletedUsersSection
            users={sortedDeletedUsers}
            canHardDeleteUsers={canHardDeleteUsers}
            onRestore={handleRestoreDeletedUser}
            onOpenHardDelete={(user) => {
              setHardDeleteConfirmText("");
              setHardDeletingUser(user);
            }}
          />
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

      <DeleteUserDialog
        user={deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleDelete}
      />

      <HardDeleteUserDialog
        user={hardDeletingUser}
        confirmText={hardDeleteConfirmText}
        isHardDeleting={isHardDeleting}
        onConfirmTextChange={setHardDeleteConfirmText}
        onClose={() => {
          setHardDeletingUser(null);
          setHardDeleteConfirmText("");
        }}
        onConfirm={handleHardDeleteUser}
      />
    </Layout>
  );
}
