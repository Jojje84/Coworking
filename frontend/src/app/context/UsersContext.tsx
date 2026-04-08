import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import { User, UserPermissions } from "../types";
import { mapUserFromApi } from "./dataShared";
import {
  createUserApi,
  deleteUserApi,
  getUsersApi,
  hardDeleteUserApi,
  restoreUserApi,
  updateUserApi,
} from "../../api/usersApi";
import { logger } from "../../utils/logger";

type UsersContextType = {
  users: User[];
  addUser: (user: {
    username: string;
    email: string;
    password: string;
    role: "user" | "admin";
    permissions?: UserPermissions;
  }) => Promise<boolean>;
  updateUser: (
    id: string,
    user: {
      username?: string;
      email?: string;
      password?: string;
      role?: "user" | "admin";
      permissions?: UserPermissions;
    },
  ) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;
  restoreUser: (id: string) => Promise<boolean>;
  hardDeleteUser: (id: string, confirmText: string) => Promise<boolean>;
};

const UsersContext = createContext<UsersContextType | undefined>(undefined);

export function UsersProvider({ children }: { children: ReactNode }) {
  const { token, user, socket } = useAuth();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!token) {
      setUsers([]);
      return;
    }

    if (user?.role !== "admin") {
      setUsers([]);
      return;
    }

    async function loadUsers() {
      try {
        const res = await getUsersApi(token, true);

        if (res.status === 403) {
          setUsers([]);
          return;
        }

        if (!res.ok) throw new Error(`Failed to load users: ${res.status}`);

        const data = await res.json();
        setUsers(data.map(mapUserFromApi));
      } catch (err) {
        logger.error("loadUsers error:", err);
        setUsers([]);
      }
    }

    loadUsers();
  }, [token, user?.role]);

  useEffect(() => {
    if (!socket) return;

    const handleUserCreated = (payload: any) => {
      const mapped = mapUserFromApi(payload);

      setUsers((prev) => {
        const exists = prev.some((u) => u.id === mapped.id);
        if (exists) return prev;
        return [mapped, ...prev];
      });

      if (user?.role === "admin") {
        toast.info(`New user registered: ${mapped.username}`);
      }
    };

    const handleUserUpdated = (payload: any) => {
      const mapped = mapUserFromApi(payload);

      setUsers((prev) => {
        const exists = prev.some((u) => u.id === mapped.id);
        if (!exists) return [mapped, ...prev];
        return prev.map((u) => (u.id === mapped.id ? mapped : u));
      });
    };

    const handleUserDeleted = (payload: any) => {
      const deletedId = payload?.id ?? payload?._id;
      if (!deletedId) return;

      const isSoftDelete = Boolean(payload?.soft);

      if (isSoftDelete) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === deletedId
              ? {
                  ...u,
                  isDeleted: true,
                  deletedAt: new Date().toISOString(),
                  deleteAfter: payload?.deleteAfter
                    ? new Date(payload.deleteAfter).toISOString()
                    : (u.deleteAfter ?? null),
                }
              : u,
          ),
        );
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== deletedId));
    };

    const handleUserRestored = (payload: any) => {
      const mapped = mapUserFromApi(payload);

      setUsers((prev) => {
        const exists = prev.some((u) => u.id === mapped.id);
        if (!exists) return [mapped, ...prev];
        return prev.map((u) => (u.id === mapped.id ? mapped : u));
      });
    };

    socket.on("user:created", handleUserCreated);
    socket.on("user:updated", handleUserUpdated);
    socket.on("user:deleted", handleUserDeleted);
    socket.on("user:restored", handleUserRestored);

    return () => {
      socket.off("user:created", handleUserCreated);
      socket.off("user:updated", handleUserUpdated);
      socket.off("user:deleted", handleUserDeleted);
      socket.off("user:restored", handleUserRestored);
    };
  }, [socket, user?.role]);

  const addUser = async (newUser: {
    username: string;
    email: string;
    password: string;
    role: "user" | "admin";
    permissions?: UserPermissions;
  }): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await createUserApi(token, {
        username: newUser.username.trim(),
        email: newUser.email.trim().toLowerCase(),
        password: newUser.password,
        role: newUser.role === "admin" ? "Admin" : "User",
        permissions:
          newUser.role === "admin"
            ? {
                bookingHardDelete: Boolean(
                  newUser.permissions?.bookingHardDelete,
                ),
                userHardDelete: Boolean(newUser.permissions?.userHardDelete),
                manageAdmins: Boolean(newUser.permissions?.manageAdmins),
                manageSettings: Boolean(newUser.permissions?.manageSettings),
                viewAuditLogs: Boolean(newUser.permissions?.viewAuditLogs),
              }
            : undefined,
      });

      if (res.status === 400) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Invalid user data");
        return false;
      }

      if (res.status === 403) {
        toast.error("Only admins can create users");
        return false;
      }

      if (res.status === 409) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Username or email already exists");
        return false;
      }

      if (!res.ok) {
        throw new Error(`Failed to create user: ${res.status}`);
      }

      const created = await res.json();
      const mapped = mapUserFromApi(created);

      setUsers((prev) => {
        const exists = prev.some((u) => u.id === mapped.id);
        if (exists) return prev;
        return [mapped, ...prev];
      });

      toast.success(`User "${mapped.username}" has been added`);
      return true;
    } catch (err) {
      logger.error("addUser error:", err);
      toast.error("Could not create user");
      return false;
    }
  };

  const updateUser = async (
    id: string,
    updatedUser: {
      username?: string;
      email?: string;
      password?: string;
      role?: "user" | "admin";
      permissions?: UserPermissions;
    },
  ): Promise<boolean> => {
    if (!token) return false;

    try {
      const body: Record<string, unknown> = {};

      if (updatedUser.username !== undefined) {
        body.username = updatedUser.username.trim();
      }

      if (updatedUser.email !== undefined) {
        body.email = updatedUser.email.trim().toLowerCase();
      }

      if (updatedUser.password !== undefined && updatedUser.password !== "") {
        body.password = updatedUser.password;
      }

      if (updatedUser.role !== undefined) {
        body.role = updatedUser.role === "admin" ? "Admin" : "User";
      }

      if (updatedUser.permissions !== undefined) {
        body.permissions = {
          bookingHardDelete: Boolean(updatedUser.permissions.bookingHardDelete),
          userHardDelete: Boolean(updatedUser.permissions.userHardDelete),
          manageAdmins: Boolean(updatedUser.permissions.manageAdmins),
          manageSettings: Boolean(updatedUser.permissions.manageSettings),
          viewAuditLogs: Boolean(updatedUser.permissions.viewAuditLogs),
        };
      }

      const res = await updateUserApi(token, id, body);

      if (res.status === 403) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Only admins can update users");
        return false;
      }

      if (res.status === 404) {
        toast.error("User not found");
        return false;
      }

      if (res.status === 409) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Username or email already exists");
        return false;
      }

      if (res.status === 400) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Invalid user data");
        return false;
      }

      if (!res.ok) {
        throw new Error(`Failed to update user: ${res.status}`);
      }

      const saved = await res.json();
      const mapped = mapUserFromApi(saved);

      setUsers((prev) => prev.map((u) => (u.id === id ? mapped : u)));
      toast.success(`User "${mapped.username}" has been updated`);
      return true;
    } catch (err) {
      logger.error("updateUser error:", err);
      toast.error("Could not update user");
      return false;
    }
  };

  const deleteUser = async (id: string): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await deleteUserApi(token, id);

      if (res.status === 404) {
        const data = await res.json().catch(() => null);
        toast.error(
          data?.message || "Users API is not available in backend yet",
        );
        return false;
      }

      if (res.status === 403) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Only admins can delete users");
        return false;
      }

      if (!res.ok) throw new Error(`Failed to delete user: ${res.status}`);

      const data = await res.json().catch(() => null);

      setUsers((prev) =>
        prev.map((u) =>
          u.id === id
            ? {
                ...u,
                isDeleted: true,
                deletedAt: new Date().toISOString(),
                deleteAfter: data?.deleteAfter
                  ? new Date(data.deleteAfter).toISOString()
                  : (u.deleteAfter ?? null),
              }
            : u,
        ),
      );

      toast.success("User soft deleted");
      return true;
    } catch (err) {
      logger.error("deleteUser error:", err);
      toast.error("Could not delete user");
      return false;
    }
  };

  const restoreUser = async (id: string): Promise<boolean> => {
    if (!token) return false;

    try {
      const res = await restoreUserApi(token, id);

      if (res.status === 404) {
        toast.error("User not found");
        return false;
      }

      if (res.status === 410) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Grace period has expired");
        return false;
      }

      if (res.status === 403) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Only admins can restore users");
        return false;
      }

      if (!res.ok) throw new Error(`Failed to restore user: ${res.status}`);

      const restored = await res.json();
      const mapped = mapUserFromApi(restored);

      setUsers((prev) => {
        const exists = prev.some((u) => u.id === mapped.id);
        if (!exists) return [mapped, ...prev];
        return prev.map((u) => (u.id === mapped.id ? mapped : u));
      });

      toast.success(`User "${mapped.username}" has been restored`);
      return true;
    } catch (err) {
      logger.error("restoreUser error:", err);
      toast.error("Could not restore user");
      return false;
    }
  };

  const hardDeleteUser = async (
    id: string,
    confirmText: string,
  ): Promise<boolean> => {
    if (!token) return false;

    try {
      const res = await hardDeleteUserApi(token, id, confirmText);

      if (res.status === 403) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "userHardDelete permission required");
        return false;
      }

      if (res.status === 400) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Could not permanently delete user");
        return false;
      }

      if (res.status === 404) {
        toast.error("User not found");
        return false;
      }

      if (!res.ok) throw new Error(`Failed to hard delete user: ${res.status}`);

      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success("User permanently deleted");
      return true;
    } catch (err) {
      logger.error("hardDeleteUser error:", err);
      toast.error("Could not permanently delete user");
      return false;
    }
  };

  const value = {
    users,
    addUser,
    updateUser,
    deleteUser,
    restoreUser,
    hardDeleteUser,
  };

  return (
    <UsersContext.Provider value={value}>{children}</UsersContext.Provider>
  );
}

export function useUsers() {
  const context = useContext(UsersContext);
  if (!context) {
    throw new Error("useUsers must be used within a UsersProvider");
  }
  return context;
}
