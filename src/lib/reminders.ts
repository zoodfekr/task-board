import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export const desktopRemindersEnabled = isTauri;

export interface ReminderDelivery {
  taskId: string;
  reminderAt: string;
  deliveredAt: string;
}

export function getReminderInbox(): Promise<ReminderDelivery[]> {
  return invoke("get_reminder_inbox");
}

export function dismissReminder(taskId: string, reminderAt: string): Promise<void> {
  return invoke("dismiss_reminder", { taskId, reminderAt });
}

export function onReminderDelivered(handler: (delivery: ReminderDelivery) => void): Promise<UnlistenFn> {
  return listen<ReminderDelivery>("reminder-delivered", (event) => handler(event.payload));
}

export function onReminderServiceError(handler: (message: string | null) => void): Promise<UnlistenFn> {
  return listen<string | null>("reminder-service-error", (event) => handler(event.payload));
}

export function isAutostartEnabled(): Promise<boolean> {
  return invoke("is_autostart_enabled");
}

export function setAutostartEnabled(enabled: boolean): Promise<boolean> {
  return invoke("set_autostart_enabled", { enabled });
}
