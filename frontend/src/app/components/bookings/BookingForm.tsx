type BookingFormProps = {
  startTime: string;
  endTime: string;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  cancelLabel?: string;
  submitLabel?: string;
};

export function BookingForm({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  onCancel,
  onSubmit,
  cancelLabel = "Cancel",
  submitLabel = "Save changes",
}: BookingFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Start time
        </label>
        <input
          type="datetime-local"
          value={startTime}
          onChange={(e) => onStartTimeChange(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          End time
        </label>
        <input
          type="datetime-local"
          value={endTime}
          onChange={(e) => onEndTimeChange(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 font-medium transition-colors hover:bg-gray-50"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onSubmit}
          className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
