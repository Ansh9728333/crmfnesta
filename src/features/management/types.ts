import type { Serialized } from "@/features/leads/types";
import type { managementService } from "@/lib/management/service";
import type { settingsService } from "@/lib/management/settings";
import type { notificationService } from "@/lib/management/notifications";
type Service = ReturnType<typeof managementService>;
export type Directory = Serialized<Awaited<ReturnType<Service["directory"]>>>;
export type Dashboard = Serialized<Awaited<ReturnType<Service["dashboard"]>>>;
export type ReportData = Serialized<Awaited<ReturnType<Service["report"]>>>;
export type SettingsData = Serialized<
  Awaited<ReturnType<ReturnType<typeof settingsService>["list"]>>
>;
export type Notifications = Serialized<
  Awaited<ReturnType<ReturnType<typeof notificationService>["list"]>>
>;
