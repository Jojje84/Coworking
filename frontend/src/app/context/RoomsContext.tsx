import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import { Room } from "../types";
import {
  mapRoomFromApi,
  mapRoomTypeFromApi,
  mapRoomTypeToApi,
} from "./dataShared";
import {
  createRoomApi,
  deleteRoomApi,
  getRoomsApi,
  updateRoomApi,
} from "../../api/roomsApi";
import { logger } from "../../utils/logger";

type RoomsContextType = {
  rooms: Room[];
  addRoom: (room: Omit<Room, "id">) => Promise<boolean>;
  updateRoom: (id: string, room: Partial<Room>) => Promise<boolean>;
  deleteRoom: (id: string) => Promise<boolean>;
};

const RoomsContext = createContext<RoomsContextType | undefined>(undefined);

export function RoomsProvider({ children }: { children: ReactNode }) {
  const { token, socket } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    if (!token) {
      setRooms([]);
      return;
    }

    async function loadRooms() {
      try {
        const res = await getRoomsApi(token);
        if (!res.ok) throw new Error(`Failed to load rooms: ${res.status}`);

        const data = await res.json();
        setRooms(data.map(mapRoomFromApi));
      } catch (err) {
        logger.error("loadRooms error:", err);
        toast.error("Could not load rooms from server");
      }
    }

    loadRooms();
  }, [token]);

  useEffect(() => {
    if (!socket) return;

    const handleRoomCreated = (payload: any) => {
      const mapped = mapRoomFromApi(payload);
      setRooms((prev) => {
        const exists = prev.some((r) => r.id === mapped.id);
        if (exists) return prev;
        return [mapped, ...prev];
      });
    };

    const handleRoomUpdated = (payload: any) => {
      const mapped = mapRoomFromApi(payload);
      setRooms((prev) => prev.map((r) => (r.id === mapped.id ? mapped : r)));
    };

    const handleRoomDeleted = (payload: any) => {
      const deletedId = payload?.id ?? payload?._id;
      if (!deletedId) return;
      setRooms((prev) => prev.filter((r) => r.id !== deletedId));
    };

    socket.on("room:created", handleRoomCreated);
    socket.on("room:updated", handleRoomUpdated);
    socket.on("room:deleted", handleRoomDeleted);

    return () => {
      socket.off("room:created", handleRoomCreated);
      socket.off("room:updated", handleRoomUpdated);
      socket.off("room:deleted", handleRoomDeleted);
    };
  }, [socket]);

  const addRoom = async (room: Omit<Room, "id">): Promise<boolean> => {
    if (!token) return false;

    try {
      const res = await createRoomApi(token, {
        name: room.name.trim(),
        capacity: room.capacity,
        type: mapRoomTypeToApi(room.type),
        description: room.description,
        imageUrl: room.imageUrl,
      });

      if (res.status === 403) {
        toast.error("Only admins can create rooms");
        return false;
      }

      if (res.status === 400) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Invalid room data");
        return false;
      }

      if (!res.ok) {
        throw new Error(`Failed to create room: ${res.status}`);
      }

      const created = await res.json();
      const mapped = mapRoomFromApi({
        ...created,
        type: mapRoomTypeFromApi(created.type),
      });

      setRooms((prev) => {
        const exists = prev.some((r) => r.id === mapped.id);
        if (exists) return prev;
        return [mapped, ...prev];
      });
      toast.success(`Room "${mapped.name}" has been added`);
      return true;
    } catch (err) {
      logger.error("addRoom error:", err);
      toast.error("Could not create room");
      return false;
    }
  };

  const updateRoom = async (
    id: string,
    room: Partial<Room>,
  ): Promise<boolean> => {
    if (!token) return false;

    try {
      const body: Record<string, unknown> = {};

      if (room.name !== undefined) body.name = room.name.trim();
      if (room.capacity !== undefined) body.capacity = room.capacity;
      if (room.type !== undefined) body.type = mapRoomTypeToApi(room.type);
      if (room.description !== undefined) body.description = room.description;
      if (room.imageUrl !== undefined) body.imageUrl = room.imageUrl;

      const res = await updateRoomApi(token, id, body);

      if (res.status === 403) {
        toast.error("Only admins can update rooms");
        return false;
      }

      if (res.status === 404) {
        toast.error("Room not found");
        return false;
      }

      if (res.status === 400) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Invalid room data");
        return false;
      }

      if (!res.ok) {
        throw new Error(`Failed to update room: ${res.status}`);
      }

      const saved = await res.json();
      const mapped = mapRoomFromApi(saved);

      setRooms((prev) => prev.map((r) => (r.id === id ? mapped : r)));
      toast.success(`Room "${mapped.name}" has been updated`);
      return true;
    } catch (err) {
      logger.error("updateRoom error:", err);
      toast.error("Could not update room");
      return false;
    }
  };

  const deleteRoom = async (id: string): Promise<boolean> => {
    if (!token) return false;

    try {
      const res = await deleteRoomApi(token, id);

      if (res.status === 403) {
        toast.error("Only admins can delete rooms");
        return false;
      }

      if (res.status === 404) {
        toast.error("Room not found");
        return false;
      }

      if (!res.ok) throw new Error(`Failed to delete room: ${res.status}`);

      setRooms((prev) => prev.filter((r) => r.id !== id));
      toast.success("Room has been deleted");
      return true;
    } catch (err) {
      logger.error("deleteRoom error:", err);
      toast.error("Could not delete room");
      return false;
    }
  };

  const value = {
    rooms,
    addRoom,
    updateRoom,
    deleteRoom,
  };

  return (
    <RoomsContext.Provider value={value}>{children}</RoomsContext.Provider>
  );
}

export function useRooms() {
  const context = useContext(RoomsContext);
  if (!context) {
    throw new Error("useRooms must be used within a RoomsProvider");
  }
  return context;
}
