import { useSortable } from "@dnd-kit/react/sortable";
import type { StickyNoteColor, Task, TaskColumnId } from "../../types/task";

const noteStyles: Record<StickyNoteColor, string> = {
  yellow: "border-amber-200 border-s-amber-400 bg-amber-50",
  pink: "border-rose-200 border-s-rose-400 bg-rose-50",
  blue: "border-sky-200 border-s-sky-400 bg-sky-50",
  green: "border-emerald-200 border-s-emerald-400 bg-emerald-50",
  purple: "border-violet-200 border-s-violet-400 bg-violet-50",
  orange: "border-orange-200 border-s-orange-400 bg-orange-50",
};

const priorityText = { low: "کم", normal: "معمولی", high: "زیاد", urgent: "فوری" } as const;
const priorityColors = {
  low: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  normal: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  high: "bg-violet-50 text-violet-700 ring-violet-100",
  urgent: "bg-rose-50 text-rose-700 ring-rose-100",
} as const;

interface TaskCardProps {
  task: Task;
  columnId: TaskColumnId;
  index: number;
  dragDisabled?: boolean;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

function formatDueDate(value: string): string {
  return new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "short" }).format(new Date(value));
}

function formatReminder(value: string): string {
  return new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function TaskCard({ task, columnId, index, dragDisabled = false, onEdit, onDelete }: TaskCardProps) {
  const sortable = useSortable({
    id: task.id,
    index,
    group: columnId,
    type: "task",
    accept: "task",
    disabled: dragDisabled,
    transition: { duration: 170, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", idle: true },
  });

  return (
    <article
      ref={sortable.ref}
      data-note-color={task.noteColor}
      className={[
        "tack-card group/card relative rounded-xl border border-s-4 px-4 py-4",
        "shadow-[0_3px_12px_rgba(31,41,55,0.045)] transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-[0_9px_22px_rgba(31,41,55,0.09)]",
        noteStyles[task.noteColor],
        sortable.isDragging ? "z-20 opacity-50 shadow-xl" : "",
      ].join(" ")}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          ref={sortable.handleRef}
          type="button"
          aria-label={`جابجایی تسک: ${task.title}`}
          title={dragDisabled ? "برای جابه‌جایی فیلترها را پاک کنید" : "برای جابه‌جایی بکشید"}
          disabled={dragDisabled}
          className="inline-flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover/card:opacity-100 focus:opacity-100 active:cursor-grabbing disabled:cursor-not-allowed"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <circle cx="7" cy="5" r="1.35" /><circle cx="13" cy="5" r="1.35" />
            <circle cx="7" cy="10" r="1.35" /><circle cx="13" cy="10" r="1.35" />
            <circle cx="7" cy="15" r="1.35" /><circle cx="13" cy="15" r="1.35" />
          </svg>
        </button>

        <div className="flex items-center gap-1 opacity-0 transition group-hover/card:opacity-100 focus-within:opacity-100">
          <button type="button" onClick={() => onEdit(task)} aria-label={`ویرایش ${task.title}`} title="ویرایش" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600">
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4"><path d="m12.8 4.2 3 3M4 16l3.4-.7 8.9-8.9a1.4 1.4 0 0 0-2-2l-8.9 8.9L4 16Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" onClick={() => onDelete(task)} aria-label={`حذف ${task.title}`} title="حذف" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4"><path d="M4.5 6h11M8 6V4.5h4V6m-6 0 .6 9h6.8l.6-9M8.5 9v3.5m3-3v3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      <h3 className="text-[15px] font-bold leading-6 text-slate-800">{task.title}</h3>
      {task.description && <p className="mt-1.5 text-[13px] leading-6 text-slate-500">{task.description}</p>}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {task.groupName && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-600">
              <span className="font-medium text-indigo-400">گروه:</span>
              {task.groupName}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${priorityColors[task.priority]}`}>
            <span className="font-medium opacity-70">اولویت:</span>
            {priorityText[task.priority]}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
          {task.dueAt && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5"><rect x="3.5" y="5" width="13" height="11.5" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M6.5 3.5v3M13.5 3.5v3M3.5 8.5h13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
              {formatDueDate(task.dueAt)}
            </span>
          )}
          {task.reminderAt && !task.remindedAt && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-indigo-500" title="یادآوری تنظیم‌شده">
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5"><path d="M10 3.5a4 4 0 0 0-4 4v2.1c0 .7-.2 1.4-.6 2L4.5 13h11l-.9-1.4a3.7 3.7 0 0 1-.6-2V7.5a4 4 0 0 0-4-4ZM8 15.5a2.1 2.1 0 0 0 4 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {formatReminder(task.reminderAt)}
            </span>
          )}
        </div>
      </footer>
    </article>
  );
}
