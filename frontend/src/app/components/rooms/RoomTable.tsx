import { MapPin, Pencil, Trash2, Users } from "lucide-react";
import { Room } from "../../types";

type RoomTableProps = {
  rooms: Room[];
  onEdit: (room: Room) => void;
  onDelete: (room: Room) => void;
};

export function RoomTable({ rooms, onEdit, onDelete }: RoomTableProps) {
  if (rooms.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center shadow-sm">
        <Users className="mx-auto mb-4 h-16 w-16 text-gray-400" />
        <p className="text-lg font-semibold text-gray-700">
          No rooms in the system yet
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Click "Add room" to create your first room.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {rooms.map((room) => (
        <div
          key={room.id}
          className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <img
            src={room.imageUrl}
            alt={room.name}
            className="h-52 w-full object-cover"
          />

          <div className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {room.name}
                </h3>
                <p className="mt-2 text-sm text-gray-600">{room.description}</p>
              </div>

              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                {room.type === "workspace" ? "Workspace" : "Conference"}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-700">
              <div className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1.5">
                <Users className="h-4 w-4" />
                <span>
                  {room.capacity} {room.capacity === 1 ? "person" : "people"}
                </span>
              </div>

              <div className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1.5">
                <MapPin className="h-4 w-4" />
                <span>
                  {room.type === "workspace" ? "Workspace" : "Conference room"}
                </span>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => onEdit(room)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-50 px-4 py-2.5 font-medium text-blue-700 transition-colors hover:bg-blue-100"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>

              <button
                onClick={() => onDelete(room)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 font-medium text-red-700 transition-colors hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
