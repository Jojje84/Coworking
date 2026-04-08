import { Filter, Search } from "lucide-react";

type AdminBookingsFiltersProps = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  filterStatus: "all" | "active" | "completed" | "cancelled";
  onFilterStatusChange: (
    value: "all" | "active" | "completed" | "cancelled",
  ) => void;
  filterOwnerState: "all" | "active-users" | "deleted-users";
  onFilterOwnerStateChange: (
    value: "all" | "active-users" | "deleted-users",
  ) => void;
};

export function AdminBookingsFilters({
  searchQuery,
  onSearchQueryChange,
  filterStatus,
  onFilterStatusChange,
  filterOwnerState,
  onFilterOwnerStateChange,
}: AdminBookingsFiltersProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-gray-900">
          Search and filter
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Find bookings by room, username, email, status or user state.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            <Search className="mr-1 inline h-4 w-4" />
            Search bookings
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search for room, username or email"
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            <Filter className="mr-1 inline h-4 w-4" />
            Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) =>
              onFilterStatusChange(
                e.target.value as "all" | "active" | "completed" | "cancelled",
              )
            }
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            User state
          </label>
          <select
            value={filterOwnerState}
            onChange={(e) =>
              onFilterOwnerStateChange(
                e.target.value as "all" | "active-users" | "deleted-users",
              )
            }
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">All users</option>
            <option value="active-users">Active users only</option>
            <option value="deleted-users">Soft deleted users only</option>
          </select>
        </div>
      </div>
    </div>
  );
}
