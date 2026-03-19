// ─────────────────────────────────────────
// Admin Rooms
// ─────────────────────────────────────────

import React, { useMemo, useState } from "react";
import { useRooms } from "../context/RoomsContext";
import { Layout } from "../components/Layout";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Plus,
  Trash2,
  X,
  Users,
  MapPin,
  DoorOpen,
  CheckCircle2,
  AlertCircle,
  Building2,
} from "lucide-react";
import { Room, RoomType } from "../types";
import { RoomTable } from "../components/rooms/RoomTable";

type RoomFormData = {
  name: string;
  capacity: number;
  type: RoomType;
  description: string;
  imageUrl: string;
};

type NoticeState = {
  type: "success" | "error";
  message: string;
} | null;

type RoomDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  title: string;
  saveLabel: string;
  formData: RoomFormData;
  setFormData: React.Dispatch<React.SetStateAction<RoomFormData>>;
};

type StatCardProps = {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
};

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

function RoomDialog({
  isOpen,
  onClose,
  onSave,
  title,
  saveLabel,
  formData,
  setFormData,
}: RoomDialogProps) {
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[95vw] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <Dialog.Title className="text-xl font-semibold text-gray-900">
                {title}
              </Dialog.Title>
              <p className="mt-1 text-sm text-gray-500">
                Fill in the room details below
              </p>
            </div>

            <Dialog.Close className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Room name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, name: e.target.value }))
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="e.g. Conference Room 1"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Capacity
                </label>
                <input
                  type="number"
                  min={1}
                  value={formData.capacity}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      capacity: Number(e.target.value || 1),
                    }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      type: e.target.value as RoomType,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="workspace">Workspace</option>
                  <option value="conference">Conference Room</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, description: e.target.value }))
                }
                rows={4}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Describe the room..."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Image URL
              </label>
              <input
                type="url"
                value={formData.imageUrl}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, imageUrl: e.target.value }))
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="https://..."
              />
            </div>

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
                {saveLabel}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AdminRooms() {
  const { rooms, addRoom, updateRoom, deleteRoom } = useRooms();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);

  const [formData, setFormData] = useState<RoomFormData>({
    name: "",
    capacity: 1,
    type: "workspace",
    description: "",
    imageUrl: "",
  });

  const sortedRooms = useMemo(
    () => [...rooms].sort((a, b) => a.name.localeCompare(b.name)),
    [rooms],
  );

  const workspaceCount = rooms.filter(
    (room) => room.type === "workspace",
  ).length;
  const conferenceCount = rooms.filter(
    (room) => room.type === "conference",
  ).length;
  const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0);

  const resetForm = () => {
    setFormData({
      name: "",
      capacity: 1,
      type: "workspace",
      description: "",
      imageUrl: "",
    });
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setNotice({
        type: "error",
        message: "Room name is required.",
      });
      return false;
    }

    if (!formData.description.trim()) {
      setNotice({
        type: "error",
        message: "Description is required.",
      });
      return false;
    }

    if (formData.capacity < 1) {
      setNotice({
        type: "error",
        message: "Capacity must be at least 1.",
      });
      return false;
    }

    return true;
  };

  const handleAdd = () => {
    setNotice(null);

    if (!validateForm()) return;

    addRoom({
      ...formData,
      name: formData.name.trim(),
      description: formData.description.trim(),
      imageUrl:
        formData.imageUrl.trim() ||
        "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop",
    });

    setNotice({
      type: "success",
      message: "Room added successfully.",
    });
    setIsAddDialogOpen(false);
    resetForm();
  };

  const handleEdit = (room: Room) => {
    setNotice(null);
    setEditingRoom(room);
    setFormData({
      name: room.name,
      capacity: room.capacity,
      type: room.type,
      description: room.description,
      imageUrl: room.imageUrl,
    });
  };

  const handleUpdate = () => {
    if (!editingRoom) return;

    setNotice(null);

    if (!validateForm()) return;

    updateRoom(editingRoom.id, {
      ...formData,
      name: formData.name.trim(),
      description: formData.description.trim(),
      imageUrl:
        formData.imageUrl.trim() ||
        "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop",
    });

    setNotice({
      type: "success",
      message: "Room updated successfully.",
    });
    setEditingRoom(null);
    resetForm();
  };

  const handleDelete = () => {
    if (!deletingRoom) return;

    deleteRoom(deletingRoom.id);

    setNotice({
      type: "success",
      message: `"${deletingRoom.name}" was removed successfully.`,
    });
    setDeletingRoom(null);
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Room Management</h1>
              <p className="mt-2 text-sm text-gray-300">
                Create, edit and manage all rooms in the system.
              </p>
            </div>

            <button
              onClick={() => {
                setNotice(null);
                resetForm();
                setIsAddDialogOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 font-medium text-slate-900 transition-colors hover:bg-gray-100"
            >
              <Plus className="h-5 w-5" />
              Add room
            </button>
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

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total rooms"
            value={rooms.length}
            subtitle="All rooms in the system"
            icon={<DoorOpen className="h-6 w-6 text-blue-600" />}
          />
          <StatCard
            title="Workspaces"
            value={workspaceCount}
            subtitle="Rooms for individual work"
            icon={<Building2 className="h-6 w-6 text-green-600" />}
          />
          <StatCard
            title="Conference rooms"
            value={conferenceCount}
            subtitle="Rooms for meetings and teams"
            icon={<MapPin className="h-6 w-6 text-purple-600" />}
          />
          <StatCard
            title="Total capacity"
            value={totalCapacity}
            subtitle="Combined number of seats"
            icon={<Users className="h-6 w-6 text-orange-600" />}
          />
        </div>

        <RoomTable
          rooms={sortedRooms}
          onEdit={handleEdit}
          onDelete={(room) => setDeletingRoom(room)}
        />
      </div>

      <RoomDialog
        isOpen={isAddDialogOpen}
        onClose={() => {
          setIsAddDialogOpen(false);
          resetForm();
        }}
        onSave={handleAdd}
        title="Add new room"
        saveLabel="Save room"
        formData={formData}
        setFormData={setFormData}
      />

      <RoomDialog
        isOpen={!!editingRoom}
        onClose={() => {
          setEditingRoom(null);
          resetForm();
        }}
        onSave={handleUpdate}
        title="Edit room"
        saveLabel="Update room"
        formData={formData}
        setFormData={setFormData}
      />

      <Dialog.Root
        open={!!deletingRoom}
        onOpenChange={(open) => {
          if (!open) setDeletingRoom(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>

              <div className="flex-1">
                <Dialog.Title className="text-lg font-semibold text-gray-900">
                  Delete room
                </Dialog.Title>
                <p className="mt-1 text-sm text-gray-600">
                  Are you sure you want to remove{" "}
                  <span className="font-semibold text-gray-900">
                    {deletingRoom?.name}
                  </span>
                  ? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDeletingRoom(null)}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 font-medium transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Layout>
  );
}
