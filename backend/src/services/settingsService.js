import { AppSettings } from "../models/AppSettings.js";

const SETTINGS_SINGLETON_KEY = "app";

export async function getOrCreateAppSettings() {
  let settings = await AppSettings.findOne({
    singletonKey: SETTINGS_SINGLETON_KEY,
  });

  if (!settings) {
    settings = await AppSettings.create({
      singletonKey: SETTINGS_SINGLETON_KEY,
    });
  }

  return settings;
}

export function toSettingsResponse(settings) {
  return {
    id: settings._id.toString(),
    allowSelfRegistration: Boolean(settings.allowSelfRegistration),
    maintenanceMode: Boolean(settings.maintenanceMode),
    adminAnnouncement: settings.adminAnnouncement || "",
    userAnnouncement: settings.userAnnouncement || "",
    updatedBy: settings.updatedBy ? settings.updatedBy.toString() : null,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
}
