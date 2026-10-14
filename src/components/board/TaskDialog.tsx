import { useRef, useState } from "react";
import type { FormEvent } from "react";
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import type { CreateTaskInput, StickyNoteColor, Task, TaskColumnId, TaskPriority } from "../../types/task";
import "react-multi-date-picker/styles/layouts/prime.css";
import { desktopRemindersEnabled } from "../../lib/reminders";

interface TaskDialogProps {
  initialTask?: Task | null;
  initialColumnId?: TaskColumnId;
  onClose: () => void;
  onSave: (input: CreateTaskInput) => Promise<void>;
}

const colors: Array<{ value: StickyNoteColor; label: string }> = [
  { value: "yellow", label: "زرد" }, { value: "pink", label: "صورتی" },
  { value: "blue", label: "آبی" }, { value: "green", label: "سبز" },
  { value: "purple", label: "بنفش" }, { value: "orange", label: "نارنجی" },
];
const priorities: Array<{ value: TaskPriority; label: string }> = [
  { value: "low", label: "کم" }, { value: "normal", label: "معمولی" },
  { value: "high", label: "زیاد" }, { value: "urgent", label: "فوری" },
];

function parseReminderDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLocalTime(date: Date | null): string {
  if (!date) return "09:00";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function applyLocalTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(date);
  next.setHours(hours || 0, minutes || 0, 0, 0);
  return next;
}

function formatPersianDate(date: Date | null): string {
  if (!date) return "انتخاب تاریخ";
  return new DateObject({ date, calendar: persian, locale: persian_fa }).format("dddd، DD MMMM YYYY");
}

export function TaskDialog({ initialTask, initialColumnId = "todo", onClose, onSave }: TaskDialogProps) {
  const [title, setTitle] = useState(initialTask?.title ?? "");
  const [description, setDescription] = useState(initialTask?.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(initialTask?.priority ?? "normal");
  const [noteColor, setNoteColor] = useState<StickyNoteColor>(initialTask?.noteColor ?? "yellow");
  const [groupName, setGroupName] = useState(initialTask?.groupName ?? "");
  const [reminderDate, setReminderDate] = useState<Date | null>(() => parseReminderDate(initialTask?.reminderAt));
  const [reminderTime, setReminderTime] = useState(() => formatLocalTime(parseReminderDate(initialTask?.reminderAt)));
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const suppressPickerOpenChangeRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!title.trim()) {
      setError("عنوان تسک را وارد کنید.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (!desktopRemindersEnabled() && reminderDate && "Notification" in window && Notification.permission === "default") {
        try { await Notification.requestPermission(); } catch { /* In-app reminder alerts still work. */ }
      }
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        columnId: initialTask?.columnId ?? initialColumnId,
        priority,
        noteColor,
        groupName: groupName.trim() || null,
        dueAt: initialTask?.dueAt ?? null,
        reminderAt: reminderDate ? reminderDate.toISOString() : null,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "ذخیرهٔ تسک ناموفق بود.");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
  const persianDigits = new Intl.NumberFormat("fa-IR", { useGrouping: false });
  const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
  const minutes = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));
  const [selectedHour, selectedMinute] = reminderTime.split(":");

  function updateReminderTime(hour: string, minute: string): void {
    const nextTime = `${hour}:${minute}`;
    setReminderTime(nextTime);
    setReminderDate((current) => current ? applyLocalTime(current, nextTime) : null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="task-dialog-title" className="tack-dialog w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 id="task-dialog-title" className="text-lg font-bold text-slate-900">{initialTask ? "ویرایش تسک" : "افزودن تسک"}</h2>
            <p className="mt-1 text-sm text-slate-500">جزئیات یادداشت را وارد کنید.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="بستن" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-800">×</button>
        </div>

        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <div>
            <label htmlFor="task-title" className="mb-1.5 block text-sm font-medium text-slate-700">عنوان</label>
            <input id="task-title" autoFocus maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثلاً: آماده‌سازی جلسهٔ هفتگی" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="task-description" className="mb-1.5 block text-sm font-medium text-slate-700">توضیحات</label>
            <textarea id="task-description" rows={4} maxLength={4000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="یادداشت یا جزئیات تکمیلی..." className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
          </div>
          <div>
            <label htmlFor="task-group" className="mb-1.5 block text-sm font-medium text-slate-700">گروه (اختیاری)</label>
            <input id="task-group" maxLength={80} value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="مثلاً: بیمه، مشتریان، ایده‌ها" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="task-reminder" className="mb-1.5 block text-sm font-medium text-slate-700">یادآوری (اختیاری)</label>
            <div dir="rtl" className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-2">
              <div className="tack-date-picker relative z-[55] flex min-w-0 items-center gap-2">
              <DatePicker
                id="task-reminder"
                value={reminderDate}
                onOpen={() => {
                  suppressPickerOpenChangeRef.current = true;
                  window.setTimeout(() => { suppressPickerOpenChangeRef.current = false; }, 150);
                }}
                onChange={(date) => {
                  if (suppressPickerOpenChangeRef.current) return;
                  setReminderDate(date ? applyLocalTime(date.toDate(), reminderTime) : null);
                }}
                render={(_, openCalendar) => (
                  <button id="task-reminder" type="button" onClick={openCalendar} className={`${fieldClass} flex items-center justify-between gap-2 text-right`}>
                    <span className={reminderDate ? "truncate text-slate-800" : "truncate text-slate-400"}>{formatPersianDate(reminderDate)}</span>
                    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-slate-400"><rect x="3.5" y="5" width="13" height="11.5" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M6.5 3.5v3M13.5 3.5v3M3.5 8.5h13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                  </button>
                )}
                calendar={persian}
                locale={persian_fa}
                format="YYYY/MM/DD"
                digits={["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"]}
                placeholder="انتخاب تاریخ"
                containerClassName="min-w-0 flex-1"
                calendarPosition="bottom-start"
                className="rmdp-prime"
                zIndex={70}
                editable={false}
                hideOnScroll
              />
              {reminderDate && (
                <button type="button" onClick={() => setReminderDate(null)} aria-label="پاک کردن یادآوری" title="پاک کردن یادآوری" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600">
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                </button>
              )}
              </div>
              <div className="relative">
                <button type="button" aria-label="ساعت یادآوری" aria-haspopup="dialog" aria-expanded={timePickerOpen} onClick={() => setTimePickerOpen((open) => !open)} className={`${fieldClass} flex items-center justify-between gap-2 text-right transition-colors hover:border-indigo-300`}>
                  <span dir="ltr" className="font-medium tabular-nums text-slate-800">{persianDigits.format(Number(selectedHour))}:{persianDigits.format(Number(selectedMinute))}</span>
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-slate-400"><circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.4" /><path d="M10 6v4l2.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                {timePickerOpen && (
                  <div role="dialog" aria-label="انتخاب ساعت یادآوری" dir="rtl" className="absolute end-0 top-full z-[75] mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_18px_50px_rgb(15_23_42_/_18%)]">
                    <div className="mb-2 flex items-center justify-between px-1">
                      <span className="text-sm font-semibold text-slate-800">زمان یادآوری</span>
                      <span dir="ltr" className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold tabular-nums text-indigo-700">{persianDigits.format(Number(selectedHour))}:{persianDigits.format(Number(selectedMinute))}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { title: "ساعت", values: hours, selected: selectedHour, select: (value: string) => updateReminderTime(value, selectedMinute) },
                        { title: "دقیقه", values: minutes, selected: selectedMinute, select: (value: string) => updateReminderTime(selectedHour, value) },
                      ].map((column) => (
                        <div key={column.title}>
                          <p className="mb-1.5 text-center text-xs font-medium text-slate-500">{column.title}</p>
                          <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl bg-slate-50 p-1">
                            {column.values.map((value) => (
                              <button key={value} type="button" aria-pressed={value === column.selected} onClick={() => column.select(value)} className={`h-8 w-full rounded-lg text-sm tabular-nums transition-colors ${value === column.selected ? "bg-indigo-600 font-semibold text-white shadow-sm" : "text-slate-700 hover:bg-indigo-100 hover:text-indigo-800"}`}>
                                {persianDigits.format(Number(value))}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => setTimePickerOpen(false)} className="mt-3 h-9 w-full rounded-xl bg-indigo-600 text-sm font-semibold text-white transition-colors hover:bg-indigo-700">تأیید ساعت</button>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">تاریخ شمسی و ساعت یادآوری را انتخاب کنید؛ ساعت پیش‌فرض ۹ صبح است.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="task-priority" className="mb-1.5 block text-sm font-medium text-slate-700">اولویت</label>
              <select id="task-priority" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)} className={fieldClass}>{priorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            </div>
            <div>
              <label htmlFor="task-color" className="mb-1.5 block text-sm font-medium text-slate-700">رنگ یادداشت</label>
              <select id="task-color" value={noteColor} onChange={(event) => setNoteColor(event.target.value as StickyNoteColor)} className={fieldClass}>{colors.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            </div>
          </div>
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">انصراف</button>
            <button type="submit" disabled={saving} className="h-10 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">{saving ? "در حال ذخیره..." : "ذخیره"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
