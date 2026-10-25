import "server-only";
import { getDb } from "../db";
import { getEnv } from "../env";
import { managementService } from "./service";
import { settingsService } from "./settings";
import { notificationService } from "./notifications";
const settings = () => {
  const e = getEnv();
  return { url: e.BETTER_AUTH_URL, secret: e.BETTER_AUTH_SECRET };
};
export const getManagementService = () => managementService(getDb(), settings());
export const getSettingsService = () => settingsService(getDb(), settings());
export const getNotificationService = () => notificationService(getDb(), settings());
