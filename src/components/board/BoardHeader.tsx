import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { StickyNoteColor, TaskPriority } from "../../types/task";
import { ReminderSettings } from "./ReminderSettings";

export type ColorFilter = StickyNoteColor | "all";
export type PriorityFilter = TaskPriority | "all";
export type GroupFilter = string | null;

type Theme = "light" | "dark";

interface BoardHeaderProps {
  colorFilter: ColorFilter;
  priorityFilter: PriorityFilter;
  groupFilter: GroupFilter;
  groups: string[];
  searchQuery: string;
  onColorFilterChange: (value: ColorFilter) => void;
  onPriorityFilterChange: (value: PriorityFilter) => void;
  onGroupFilterChange: (value: GroupFilter) => void;
  onSearchQueryChange: (value: string) => void;
  onAddTask: () => void;
  windowControlsEnabled?: boolean;
}

const colorOptions: Array<{ value: ColorFilter; label: string }> = [
  { value: "all", label: "همه رنگ‌ها" },
  { value: "yellow", label: "زرد" },
  { value: "pink", label: "صورتی" },
  { value: "blue", label: "آبی" },
  { value: "green", label: "سبز" },
  { value: "purple", label: "بنفش" },
  { value: "orange", label: "نارنجی" },
];

const priorityOptions: Array<{ value: PriorityFilter; label: string }> = [
  { value: "all", label: "همه اولویت‌ها" },
  { value: "low", label: "کم" },
  { value: "normal", label: "معمولی" },
  { value: "high", label: "زیاد" },
  { value: "urgent", label: "فوری" },
];

const selectClass = "h-10 min-w-0 w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pe-3 ps-9 text-sm text-slate-700 shadow-sm outline-none transition hover:border-indigo-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

export function BoardHeader({
  colorFilter,
  priorityFilter,
  groupFilter,
  groups,
  searchQuery,
  onColorFilterChange,
  onPriorityFilterChange,
  onGroupFilterChange,
  onSearchQueryChange,
  onAddTask,
  windowControlsEnabled = true,
}: BoardHeaderProps) {
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminderSettingsOpen, setReminderSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem("tack-theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("tack-theme", theme); } catch { /* Theme still applies for this session. */ }
  }, [theme]);

  useEffect(() => {
    if (!windowControlsEnabled) {
      setReady(true);
      return;
    }
    let alive = true;
    getCurrentWindow().isAlwaysOnTop()
      .then((value) => { if (alive) setAlwaysOnTop(value); })
      .catch(() => { if (alive) setError("خواندن وضعیت پنجره ناموفق بود."); })
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [windowControlsEnabled]);

  async function toggleAlwaysOnTop(): Promise<void> {
    const next = !alwaysOnTop;
    setBusy(true);
    setError(null);
    try {
      await getCurrentWindow().setAlwaysOnTop(next);
      setAlwaysOnTop(next);
    } catch {
      setError("تغییر وضعیت همیشه‌رو ناموفق بود؛ مجوز پنجره را بررسی کنید.");
    } finally {
      setBusy(false);
    }
  }

  const controlClass = "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <>
    <header className="tack-header relative z-10 flex shrink-0 flex-col gap-3 border-b border-slate-200/70 bg-white px-4 py-3 shadow-[0_4px_14px_rgba(15,23,42,0.035)] sm:px-6">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold leading-none text-white shadow-[0_5px_12px_rgba(79,70,229,0.22)]">T</div>
          <div>
            <h1 className="text-xl font-bold leading-none tracking-tight text-indigo-950">Task Board</h1>
            <p className="mt-1 text-[9px] font-semibold tracking-[0.15em] text-slate-400">LOCAL TASK BOARD</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")} aria-pressed={theme === "dark"} aria-label={theme === "dark" ? "فعال‌کردن تم روشن" : "فعال‌کردن تم تاریک"} title={theme === "dark" ? "تم روشن" : "تم تاریک"} className={controlClass}>
            {theme === "dark" ? (
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-amber-500"><circle cx="10" cy="10" r="3.3" stroke="currentColor" strokeWidth="1.5" /><path d="M10 2.5v1.6m0 11.8v1.6m7.5-7.5h-1.6M4.1 10H2.5m12.8-5.3-1.1 1.1m-8.4 8.4-1.1 1.1m11.2 0-1.1-1.1m-8.4-8.4L5.3 4.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-indigo-600"><path d="M16.5 12.7A7 7 0 0 1 7.3 3.5a7.2 7.2 0 1 0 9.2 9.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
            )}
            <span className="hidden sm:inline">{theme === "dark" ? "روشن" : "تاریک"}</span>
          </button>

          {windowControlsEnabled && (
            <button type="button" onClick={() => setReminderSettingsOpen(true)} className={controlClass} title="تنظیم اعلان‌ها و اجرای پس‌زمینه">اعلان‌ها</button>
          )}

          {windowControlsEnabled && (
            <button type="button" onClick={() => void toggleAlwaysOnTop()} disabled={!ready || busy} aria-pressed={alwaysOnTop} title={alwaysOnTop ? "خاموش‌کردن همیشه‌رو" : "نمایش پنجره روی پنجره‌های دیگر"} className={`${controlClass} ${alwaysOnTop ? "border-indigo-200 bg-indigo-50 text-indigo-700" : ""}`}>
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4"><path d="m10 2.8 2 3.4 3.9.7-2.7 2.8.5 3.9-3.7-1.8-3.7 1.8.5-3.9-2.7-2.8 3.9-.7 2-3.4Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
              <span>همیشه‌رو</span>
            </button>
          )}

          <button type="button" onClick={onAddTask} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-[0_5px_12px_rgba(79,70,229,0.2)] transition hover:bg-indigo-700 active:scale-[0.98]">
            <span aria-hidden="true" className="text-lg leading-none">＋</span> تسک جدید
          </button>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.8fr)_repeat(3,minmax(150px,1fr))]">
        <div className="relative min-w-0 sm:col-span-2 xl:col-span-1">
          <label htmlFor="task-search" className="sr-only">جست‌وجوی تسک‌ها</label>
          <input id="task-search" type="search" value={searchQuery} onChange={(event) => onSearchQueryChange(event.target.value)} placeholder="جست‌وجوی عنوان، توضیح یا گروه..." className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pe-3 ps-10 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-indigo-300 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100" />
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"><circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" strokeWidth="1.7" /><path d="m16 16 4.2 4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
        </div>

        <label className="relative min-w-0">
          <span className="sr-only">فیلتر گروه</span>
          <select aria-label="فیلتر گروه" value={groupFilter ?? ""} onChange={(event) => onGroupFilterChange(event.target.value || null)} className={selectClass}>
            <option value="">همه گروه‌ها</option>
            {groups.map((group) => <option key={group} value={group}>{group}</option>)}
          </select>
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-500"><path d="M3.5 5.5h13l-5 5.5v4l-3-1.5V11l-5-5.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
        </label>

        <label className="relative min-w-0">
          <span className="sr-only">فیلتر رنگ</span>
          <select aria-label="فیلتر رنگ" value={colorFilter} onChange={(event) => onColorFilterChange(event.target.value as ColorFilter)} className={selectClass}>
            {colorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-gradient-to-br from-fuchsia-400 to-emerald-400" />
        </label>

        <label className="relative min-w-0">
          <span className="sr-only">فیلتر اولویت</span>
          <select aria-label="فیلتر اولویت" value={priorityFilter} onChange={(event) => onPriorityFilterChange(event.target.value as PriorityFilter)} className={selectClass}>
            {priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-500"><path d="m10 2.8 2 3.4 3.9.7-2.7 2.8.5 3.9-3.7-1.8-3.7 1.8.5-3.9-2.7-2.8 3.9-.7 2-3.4Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
        </label>
      </div>

      {error && <p role="status" className="text-xs text-rose-700">{error}</p>}
    </header>
    {reminderSettingsOpen && <ReminderSettings onClose={() => setReminderSettingsOpen(false)} />}
    </>
  );
}
