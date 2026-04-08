import { createContext, ReactNode, useContext, useMemo } from "react";
import {
  Booking,
  CalendarBooking,
  Room,
  User,
  UserPermissions,
} from "../types";
import { RoomsProvider, useRooms } from "./RoomsContext";
import { BookingsProvider, useBookings } from "./BookingsContext";
import { UsersProvider, useUsers } from "./UsersContext";
import { SettingsProvider, useSettings } from "./SettingsContext";

interface DataContextType {
  rooms: Room[];
  bookings: Booking[];
  calendarBookings: CalendarBooking[];
  users: User[];
  newBookingIds: string[];
  adminAnnouncement: string;
  userAnnouncement: string;

  loadCalendarBookings: (start: string, end: string) => Promise<void>;

  addRoom: (room: Omit<Room, "id">) => Promise<boolean>;
  updateRoom: (id: string, room: Partial<Room>) => Promise<boolean>;
  deleteRoom: (id: string) => Promise<boolean>;

  addBooking: (
    booking: Omit<Booking, "id" | "createdAt" | "status">,
  ) => Promise<boolean>;
  updateBooking: (id: string, booking: Partial<Booking>) => Promise<boolean>;
  cancelBooking: (id: string) => Promise<boolean>;
  deleteBooking: (id: string) => Promise<boolean>;
  hardDeleteBooking: (id: string, confirmText: string) => Promise<boolean>;

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

  isRoomAvailable: (
    roomId: string,
    startTime: string,
    endTime: string,
    excludeBookingId?: string,
  ) => boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

function DataComposedProvider({ children }: { children: ReactNode }) {
  const rooms = useRooms();
  const bookings = useBookings();
  const users = useUsers();
  const settings = useSettings();

  const value = useMemo(
    () => ({
      ...rooms,
      ...bookings,
      ...users,
      ...settings,
    }),
    [rooms, bookings, users, settings],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function DataProvider({ children }: { children: ReactNode }) {
  return (
    <RoomsProvider>
      <BookingsProvider>
        <UsersProvider>
          <SettingsProvider>
            <DataComposedProvider>{children}</DataComposedProvider>
          </SettingsProvider>
        </UsersProvider>
      </BookingsProvider>
    </RoomsProvider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
