import { MapPin, Search, Users } from "lucide-react";
import { Room, RoomType } from "../../types";

type RoomSelectionGridProps = {
  rooms: Room[];
  selectedRoomId: string;
  searchQuery: string;
  filterType: RoomType | "all";
  filterCapacity: number;
  onSearchQueryChange: (value: string) => void;
  onFilterTypeChange: (value: RoomType | "all") => void;
  onFilterCapacityChange: (value: number) => void;
  onSelectRoom: (room: Room) => void;
};

export function RoomSelectionGrid({
  rooms,
  selectedRoomId,
  searchQuery,
  filterType,
  filterCapacity,
  onSearchQueryChange,
  onFilterTypeChange,
  onFilterCapacityChange,
  onSelectRoom,
}: RoomSelectionGridProps) {
  const filteredRooms = rooms
    .filter((room) => {
      const matchesSearch = room.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesType = filterType === "all" || room.type === filterType;
      const matchesCapacity =
        filterCapacity === 0 || room.capacity >= filterCapacity;

      return matchesSearch && matchesType && matchesCapacity;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-gray-900">
            Search and filter
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Find the right room by name, type and capacity.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Search room
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="Search for room"
                className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Room type
            </label>
            <select
              value={filterType}
              onChange={(e) =>
                onFilterTypeChange(e.target.value as RoomType | "all")
              }
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">All types</option>
              <option value="workspace">Workspace</option>
              <option value="conference">Conference room</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Min. capacity
            </label>
            <select
              value={filterCapacity}
              onChange={(e) => onFilterCapacityChange(Number(e.target.value))}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="0">All</option>
              <option value="1">1+</option>
              <option value="4">4+</option>
              <option value="8">8+</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {filteredRooms.map((room) => (
          <button
            key={room.id}
            type="button"
            onClick={() => onSelectRoom(room)}
            className={`overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
              selectedRoomId === room.id
                ? "border-blue-600 ring-2 ring-blue-100"
                : "border-gray-100"
            }`}
          >
            <img
              src={room.imageUrl}
              alt={room.name}
              className="h-48 w-full object-cover"
            />

            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {room.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {room.description}
                  </p>
                </div>

                {selectedRoomId === room.id && (
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    Selected
                  </span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-700">
                <div className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1.5">
                  <Users className="h-4 w-4" />
                  <span>
                    {room.capacity} {room.capacity === 1 ? "person" : "persons"}
                  </span>
                </div>

                <div className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1.5">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {room.type === "workspace"
                      ? "Workspace"
                      : "Conference room"}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {filteredRooms.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center shadow-sm">
          <Search className="mx-auto mb-4 h-14 w-14 text-gray-400" />
          <p className="text-lg font-medium text-gray-700">
            No rooms match your filters
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search, type or capacity.
          </p>
        </div>
      )}
    </>
  );
}
