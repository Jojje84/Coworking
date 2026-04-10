// ─────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────

import { useAuth } from "../context/AuthContext";
import { useBookings } from "../context/BookingsContext";
import { useRooms } from "../context/RoomsContext";
import { useUsers } from "../context/UsersContext";
import { Layout } from "../components/Layout";
import { Calendar, Users, DoorOpen, CheckCircle } from "lucide-react";
import { isSameDay } from "date-fns";
import {
  isBookingUpcoming,
  sortByCreatedAtDesc,
  sortByStartTimeAsc,
} from "../../utils/booking";
import {
  BookingListPanel,
  DashboardCalendarCard,
  DashboardBooking,
  StatCard,
} from "../components/dashboard/DashboardSections";

export function Dashboard() {
  const { user } = useAuth();

  if (user?.role === "admin") {
    return <AdminDashboard />;
  }

  return <UserDashboard />;
}

function UserDashboard() {
  const { user } = useAuth();
  const { rooms } = useRooms();
  const { bookings } = useBookings();

  const userBookings = bookings.filter(
    (b) => b.userId === user?.id && b.status === "active",
  );

  const upcomingBookings = userBookings.filter((b) =>
    isBookingUpcoming(b.startTime),
  );

  const sortedUpcomingBookings = sortByStartTimeAsc(upcomingBookings);

  return (
    <Layout>
      <div className="space-y-8">
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm">
          <h1 className="text-3xl font-bold">Welcome, {user?.username}!</h1>
          <p className="mt-2 text-sm text-blue-100">
            Here is an overview of your bookings and upcoming activity.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <StatCard
            title="Active bookings"
            value={userBookings.length}
            subtitle="All your currently active reservations"
            icon={<Calendar className="h-6 w-6 text-blue-600" />}
          />
          <StatCard
            title="Upcoming bookings"
            value={sortedUpcomingBookings.length}
            subtitle="Bookings scheduled for future dates"
            icon={<CheckCircle className="h-6 w-6 text-green-600" />}
          />
          <StatCard
            title="Available rooms"
            value={rooms.length}
            subtitle="Rooms currently available in the system"
            icon={<DoorOpen className="h-6 w-6 text-purple-600" />}
          />
        </div>

        <DashboardCalendarCard
          title="My booking calendar"
          bookings={userBookings}
          rooms={rooms}
          showUserName={false}
        />

        <BookingListPanel
          title="Upcoming bookings"
          subtitle="Your next scheduled room reservations"
          bookings={sortedUpcomingBookings as DashboardBooking[]}
          emptyTitle="No upcoming bookings"
          emptyDescription="When you create a booking, it will appear here."
          rooms={rooms}
        />
      </div>
    </Layout>
  );
}

function AdminDashboard() {
  const { rooms } = useRooms();
  const { bookings } = useBookings();
  const { users: allUsers } = useUsers();

  const activeBookings = bookings.filter((b) => b.status === "active");

  const todayBookings = activeBookings.filter((b) =>
    isSameDay(new Date(b.startTime), new Date()),
  );

  const latestBookings = sortByCreatedAtDesc(bookings).slice(0, 5);

  return (
    <Layout>
      <div className="space-y-8">
        <div className="rounded-2xl bg-gradient-to-r from-gray-900 to-slate-800 p-6 text-white shadow-sm">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="mt-2 text-sm text-gray-300">
            System overview for rooms, users and bookings.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total rooms"
            value={rooms.length}
            subtitle="All rooms in the system"
            icon={<DoorOpen className="h-6 w-6 text-blue-600" />}
          />
          <StatCard
            title="Registered users"
            value={allUsers.length}
            subtitle="All users with an account"
            icon={<Users className="h-6 w-6 text-green-600" />}
          />
          <StatCard
            title="Active bookings"
            value={activeBookings.length}
            subtitle="Bookings that are currently active"
            icon={<Calendar className="h-6 w-6 text-purple-600" />}
          />
          <StatCard
            title="Today's bookings"
            value={todayBookings.length}
            subtitle="Active reservations scheduled for today"
            icon={<CheckCircle className="h-6 w-6 text-orange-600" />}
          />
        </div>

        <DashboardCalendarCard
          title="Booking calendar"
          bookings={activeBookings}
          rooms={rooms}
          users={allUsers}
          showUserName={true}
        />

        <BookingListPanel
          title="Latest bookings"
          subtitle="Recently created or updated reservations"
          bookings={latestBookings as DashboardBooking[]}
          emptyTitle="No bookings yet"
          emptyDescription="The latest bookings will appear here."
          rooms={rooms}
          users={allUsers}
          showUserName={true}
          showStatus={true}
          dateFormat="PPP HH:mm"
        />
      </div>
    </Layout>
  );
}
