import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { AppSettings } from "../types";
import { Save, Settings2 } from "lucide-react";
import {
  getSettingsApi,
  parseSettingsResponse,
  updateSettingsApi,
} from "../../api/settingsApi";
import { logger } from "../../utils/logger";

export function AdminSettings() {
  const { token } = useAuth();
  const { adminAnnouncement, userAnnouncement } = useSettings();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function loadSettings() {
      if (!token) return;

      setIsLoading(true);
      setError("");
      setNotice("");

      try {
        const res = await getSettingsApi(token);

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          setError(data?.message || "Could not load settings");
          return;
        }

        setSettings(parseSettingsResponse(data));
      } catch (err) {
        logger.error("load settings error:", err);
        setError("Could not load settings");
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [token]);

  useEffect(() => {
    setSettings((prev) => {
      if (!prev) return prev;

      const nextAdmin = String(adminAnnouncement || "").trim();
      const nextUser = String(userAnnouncement || "").trim();
      const changed =
        prev.adminAnnouncement !== nextAdmin ||
        prev.userAnnouncement !== nextUser;

      if (!changed) return prev;

      setNotice("Settings updated live");
      setError("");

      return {
        ...prev,
        adminAnnouncement: nextAdmin,
        userAnnouncement: nextUser,
      };
    });
  }, [adminAnnouncement, userAnnouncement]);

  const updateField = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const saveSettings = async () => {
    if (!token || !settings) return;

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const res = await updateSettingsApi(token, {
        allowSelfRegistration: settings.allowSelfRegistration,
        maintenanceMode: settings.maintenanceMode,
        adminAnnouncement: settings.adminAnnouncement,
        userAnnouncement: settings.userAnnouncement,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.message || "Could not save settings");
        return;
      }

      setSettings(parseSettingsResponse(data));
      setNotice("Settings saved successfully");
    } catch (err) {
      logger.error("save settings error:", err);
      setError("Could not save settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-sm">
          <div className="flex items-center gap-3">
            <Settings2 className="h-7 w-7" />
            <div>
              <h1 className="text-3xl font-bold">System Settings</h1>
              <p className="mt-1 text-sm text-slate-200">
                Manage registration policy and system-wide admin messages.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {notice && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {notice}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-600 shadow-sm">
            Loading settings...
          </div>
        ) : !settings ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-600 shadow-sm">
            Settings could not be loaded.
          </div>
        ) : (
          <div className="space-y-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-4">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={settings.allowSelfRegistration}
                onChange={(e) =>
                  updateField("allowSelfRegistration", e.target.checked)
                }
              />
              <span>
                <span className="block text-sm font-medium text-gray-900">
                  Allow self registration
                </span>
                <span className="block text-sm text-gray-500">
                  If disabled, only admins can create users.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-4">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={settings.maintenanceMode}
                onChange={(e) =>
                  updateField("maintenanceMode", e.target.checked)
                }
              />
              <span>
                <span className="block text-sm font-medium text-gray-900">
                  Maintenance mode
                </span>
                <span className="block text-sm text-gray-500">
                  Use this as an operational flag for scheduled maintenance.
                </span>
              </span>
            </label>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Admin announcement
              </label>
              <textarea
                value={settings.adminAnnouncement}
                onChange={(e) =>
                  updateField("adminAnnouncement", e.target.value)
                }
                maxLength={500}
                rows={5}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Write a message visible to admins in operational dashboards"
              />
              <div className="mt-1 text-right text-xs text-gray-400">
                {settings.adminAnnouncement.length}/500
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                User announcement
              </label>
              <textarea
                value={settings.userAnnouncement}
                onChange={(e) =>
                  updateField("userAnnouncement", e.target.value)
                }
                maxLength={500}
                rows={5}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Write a message visible to all regular users"
              />
              <div className="mt-1 text-right text-xs text-gray-400">
                {settings.userAnnouncement.length}/500
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={saveSettings}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving" : "Save settings"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
