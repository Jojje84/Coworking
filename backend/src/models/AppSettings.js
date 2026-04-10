import mongoose from "mongoose";

const appSettingsSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      required: true,
      unique: true,
      default: "app",
    },
    allowSelfRegistration: {
      type: Boolean,
      default: true,
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    adminAnnouncement: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    userAnnouncement: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

export const AppSettings = mongoose.model("AppSettings", appSettingsSchema);
