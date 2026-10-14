import { useEffect, useState } from "react";
import { isAutostartEnabled, sendTestNotification, setAutostartEnabled } from "../../lib/reminders";

export function ReminderSettings({ onClose }: { onClose: () => void }) {
  const [autostart, setAutostart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void isAutostartEnabled().then((enabled) => {
      if (alive) setAutostart(enabled);
    }).catch(() => {
      if (alive) setError("خواندن وضعیت اجرای خودکار انجام نشد.");
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  async function toggleAutostart(): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setAutostart(await setAutostartEnabled(!autostart));
    } catch {
      setError("تغییر اجرای خودکار انجام نشد؛ دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  async function testNotification(): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await sendTestNotification();
      setMessage("اعلان آزمایشی به ویندوز ارسال شد. اگر نمایش داده نشد، تنظیمات اعلان ویندوز را بررسی کنید.");
    } catch {
      setError("ارسال اعلان آزمایشی انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="reminder-settings-title" className="tack-dialog w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="reminder-settings-title" className="text-lg font-bold text-slate-900">اعلان‌ها و اجرای پس‌زمینه</h2>
          <button type="button" aria-label="بستن تنظیمات اعلان" onClick={onClose} disabled={busy} className="h-8 w-8 rounded-lg text-xl text-slate-400 hover:bg-slate-100">×</button>
        </div>
        <p className="text-sm leading-7 text-slate-600">یادآوری‌ها با اعلان ویندوز نمایش داده می‌شوند، حتی اگر پنجره مینیمایز باشد یا در برنامهٔ دیگری کار کنید.</p>
        <p className="mt-2 text-sm leading-7 text-slate-600">با بستن پنجره، Task Board کنار ساعت ویندوز فعال می‌ماند. برای بازکردن برنامه روی آیکون آن کلیک کنید؛ برای توقف کامل، از منوی همان آیکون «خروج کامل» را انتخاب کنید.</p>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
          <input type="checkbox" checked={autostart} disabled={loading || busy} onChange={() => void toggleAutostart()} className="mt-1 h-4 w-4 accent-indigo-600" />
          <span>
            <span className="block text-sm font-semibold text-slate-800">اجرا هنگام ورود به ویندوز</span>
            <span className="mt-1 block text-xs leading-6 text-slate-500">برنامه بدون بازکردن پنجره کنار ساعت فعال می‌شود تا یادآوری‌ها ادامه پیدا کنند.</span>
          </span>
        </label>
        <p className="mt-3 text-xs leading-6 text-slate-500">در زمان خاموشی، خواب سیستم یا خروج کامل، اعلان نمایش داده نمی‌شود. یادآوری‌های عقب‌افتاده پس از فعال‌شدن دوبارهٔ برنامه بررسی می‌شوند. حالت «مزاحم نشوید» ویندوز می‌تواند نمایش بنر را متوقف کند.</p>
        {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {message && <p role="status" className="mt-3 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-700">{message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => void testNotification()} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 disabled:opacity-50">ارسال اعلان آزمایشی</button>
          <button type="button" disabled={busy} onClick={onClose} className="h-10 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-50">بستن</button>
        </div>
      </section>
    </div>
  );
}
