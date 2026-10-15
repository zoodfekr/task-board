import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getTasks, updateTask } from "../../lib/database";
import { getReminderInbox } from "../../lib/reminders";
import type { Task } from "../../types/task";
import { ReminderMonitor } from "./ReminderMonitor";

export function ReminderPopup() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    document.documentElement.classList.add("tack-popup-mode");
    return () => document.documentElement.classList.remove("tack-popup-mode");
  }, []);

  useEffect(() => {
    let alive = true;
    let sawReminder = false;
    const openedAt = Date.now();

    async function refresh(): Promise<void> {
      try {
        const [inbox, latestTasks] = await Promise.all([getReminderInbox(), getTasks()]);
        if (!alive) return;
        setTasks(latestTasks);
        if (inbox.length > 0) sawReminder = true;
        if ((sawReminder && inbox.length === 0) || (!sawReminder && Date.now() - openedAt > 8_000)) {
          await getCurrentWindow().close();
        }
      } catch {
        // A transient database startup delay should not close the reminder window.
      }
    }

    void refresh();
    const interval = window.setInterval(() => void refresh(), 1_000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, []);

  async function reschedule(taskId: string, reminderAt: string): Promise<void> {
    await updateTask(taskId, { reminderAt });
  }

  return (
    <div className="tack-reminder-window" dir="rtl">
      <ReminderMonitor tasks={tasks} onAcknowledge={() => undefined} onReschedule={reschedule} />
    </div>
  );
}
