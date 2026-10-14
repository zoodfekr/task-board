import { useEffect, useRef, useState } from "react";
import type { Task } from "../../types/task";
import {
  desktopRemindersEnabled, dismissReminder, getReminderInbox,
  onReminderDelivered, onReminderServiceError,
} from "../../lib/reminders";

interface ReminderMonitorProps {
  tasks: readonly Task[];
  onAcknowledge: (taskId: string, acknowledgedAt: string) => Promise<void> | void;
  onReschedule: (taskId: string, reminderAt: string) => Promise<void> | void;
}

function reminderTime(value: string): string {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ReminderMonitor({ tasks, onAcknowledge, onReschedule }: ReminderMonitorProps) {
  const [alerts, setAlerts] = useState<Task[]>([]);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const seenRef = useRef(new Set<string>());
  const notificationsRef = useRef(new Map<string, { notification: Notification; title: string }>());
  const acknowledgeRef = useRef(onAcknowledge);
  const rescheduleRef = useRef(onReschedule);
  acknowledgeRef.current = onAcknowledge;
  rescheduleRef.current = onReschedule;

  useEffect(() => {
    if (!desktopRemindersEnabled()) return;
    let alive = true;
    let refreshId = 0;
    const unlisteners: Array<() => void> = [];
    async function refresh(): Promise<void> {
      const requestId = ++refreshId;
      try {
        const inbox = await getReminderInbox();
        if (!alive || requestId !== refreshId) return;
        setAlerts(inbox.flatMap((delivery) => {
          const task = tasks.find((item) => item.id === delivery.taskId && item.reminderAt === delivery.reminderAt);
          return task ? [{ ...task, remindedAt: delivery.deliveredAt }] : [];
        }));
      } catch {
        if (alive) setServiceError("خواندن یادآوری‌های دریافت‌شده انجام نشد.");
      }
    }
    function retain(unlisten: () => void): void {
      if (alive) unlisteners.push(unlisten);
      else unlisten();
    }
    async function subscribe(): Promise<void> {
      try {
        retain(await onReminderDelivered(() => { void refresh(); }));
        retain(await onReminderServiceError((message) => {
          if (alive) setServiceError(message ? "ارسال یادآوری‌های ویندوز با خطا مواجه شد؛ برنامه دوباره تلاش می‌کند." : null);
        }));
        if (alive) await refresh();
      } catch {
        if (alive) setServiceError("اتصال به سرویس یادآوری انجام نشد.");
      }
    }
    void subscribe();
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [tasks]);

  async function dismiss(task: Task): Promise<void> {
    setBusyTaskId(task.id);
    setActionError(null);
    try {
      if (desktopRemindersEnabled() && task.reminderAt) {
        await dismissReminder(task.id, task.reminderAt);
      }
      setAlerts((current) => current.filter((item) => item.id !== task.id));
    } catch {
      setActionError("ثبت تأیید یادآوری انجام نشد؛ دوباره تلاش کنید.");
    } finally {
      setBusyTaskId(null);
    }
  }

  useEffect(() => {
    const currentReminders = new Map<string, Task>(
      tasks.flatMap((task) => task.reminderAt
        ? [[`${task.id}:${task.reminderAt}`, task] as [string, Task]]
        : []),
    );
    for (const reminderKey of seenRef.current) {
      if (!currentReminders.has(reminderKey)) seenRef.current.delete(reminderKey);
    }
    for (const [reminderKey, entry] of notificationsRef.current) {
      const latest = currentReminders.get(reminderKey);
      if (!latest || latest.title !== entry.title) {
        entry.notification.close();
        notificationsRef.current.delete(reminderKey);
      }
    }

    setAlerts((current) => {
      const next = current.flatMap((alert) => {
        if (!alert.reminderAt) return [];
        const latest = currentReminders.get(`${alert.id}:${alert.reminderAt}`);
        return latest ? [latest] : [];
      });
      return next.length === current.length && next.every((task, index) => task === current[index])
        ? current
        : next;
    });
  }, [tasks]);

  async function postpone(task: Task, duration: "tomorrow" | "hour"): Promise<void> {
    const nextReminder = new Date();
    if (duration === "tomorrow") nextReminder.setDate(nextReminder.getDate() + 1);
    else nextReminder.setTime(nextReminder.getTime() + 60 * 60 * 1000);

    setBusyTaskId(task.id);
    setActionError(null);
    try {
      await rescheduleRef.current(task.id, nextReminder.toISOString());
      setAlerts((current) => current.filter((item) => item.id !== task.id));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "تنظیم دوبارهٔ یادآوری انجام نشد.");
    } finally {
      setBusyTaskId(null);
    }
  }

  useEffect(() => {
    // The desktop scheduler owns delivery and acknowledgement. Running this
    // browser timer as well would consume reminders before Windows receives them.
    if (desktopRemindersEnabled()) return;
    function checkReminders(): void {
      const now = Date.now();
      for (const task of tasks) {
        if (!task.reminderAt || task.remindedAt || new Date(task.reminderAt).getTime() > now) continue;
        const reminderKey = `${task.id}:${task.reminderAt}`;
        if (seenRef.current.has(reminderKey)) continue;
        seenRef.current.add(reminderKey);
        setAlerts((current) => current.some((item) => item.id === task.id) ? current : [task, ...current]);
        try {
          if ("Notification" in window && Notification.permission === "granted") {
            const notification = new Notification("یادآور Task Board", {
              body: `زمان انجام «${task.title}» رسیده است.`,
              tag: `tack-reminder-${task.id}`,
            });
            notificationsRef.current.set(reminderKey, { notification, title: task.title });
            notification.onclose = () => {
              if (notificationsRef.current.get(reminderKey)?.notification === notification) {
                notificationsRef.current.delete(reminderKey);
              }
            };
          }
        } catch {
          // The in-app alert below remains available if system notifications are unavailable.
        }
        void Promise.resolve(acknowledgeRef.current(task.id, new Date().toISOString())).catch(() => {
          seenRef.current.delete(reminderKey);
        });
      }
    }

    checkReminders();
    const intervalId = window.setInterval(checkReminders, 15_000);
    return () => window.clearInterval(intervalId);
  }, [tasks]);

  if (alerts.length === 0 && !serviceError) return null;

  return (
    <div className="fixed bottom-4 end-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="assertive">
      {serviceError && <p role="status" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{serviceError}</p>}
      {alerts.map((task) => (
        <section key={task.id} role="alert" className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-[0_16px_48px_rgba(30,41,59,0.2)]">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5"><path d="M10 3.5a4 4 0 0 0-4 4v2.1c0 .7-.2 1.4-.6 2L4.5 13h11l-.9-1.4a3.7 3.7 0 0 1-.6-2V7.5a4 4 0 0 0-4-4ZM8 15.5a2.1 2.1 0 0 0 4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-slate-900">یادآوری کار</h2>
              <p className="mt-1 break-words text-sm text-slate-700">{task.title}</p>
              <p className="mt-1 text-xs text-slate-500">زمان انجام این کار رسیده است · {task.reminderAt ? reminderTime(task.reminderAt) : ""}</p>
            </div>
            <button type="button" disabled={busyTaskId !== null} onClick={() => void dismiss(task)} className="rounded-lg px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">متوجه شدم</button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" disabled={busyTaskId !== null} onClick={() => void postpone(task, "tomorrow")} className="h-9 rounded-xl border border-indigo-200 bg-indigo-50 px-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-wait disabled:opacity-50">
              {busyTaskId === task.id ? "در حال ذخیره…" : "فردا یادآوری کن"}
            </button>
            <button type="button" disabled={busyTaskId !== null} onClick={() => void postpone(task, "hour")} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50">
              یک ساعت بعد
            </button>
          </div>
          {actionError && <p role="status" className="mt-2 text-xs text-rose-600">{actionError}</p>}
        </section>
      ))}
    </div>
  );
}
