import { CollisionPriority } from "@dnd-kit/abstract";
import { useDroppable } from "@dnd-kit/react";
import type { Task, TaskColumn } from "../../types/task";
import { TaskCard } from "../cards/TaskCard";

interface KanbanColumnProps {
  column: TaskColumn;
  tasks: Task[];
  dragDisabled?: boolean;
  onAddTask: (column: TaskColumn) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
}

export function KanbanColumn({
  column,
  tasks,
  dragDisabled = false,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: KanbanColumnProps) {
  const drop = useDroppable({
    id: column.id,
    type: "column",
    accept: "task",
    collisionPriority: CollisionPriority.Low,
    disabled: dragDisabled,
  });

  return (
    <section
      ref={drop.ref}
      aria-label={column.title}
      className={[
        "tack-column flex h-full min-h-0 min-w-[280px] flex-1 flex-col rounded-2xl border border-slate-200/70 bg-[#f5f6fa] p-3.5",
        "transition-colors duration-150",
        drop.isDropTarget ? "bg-indigo-50 ring-2 ring-indigo-300" : "",
      ].join(" ")}
    >
      <header className="mb-3 flex items-center justify-between gap-3 px-1 py-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-base font-bold text-slate-800">{column.title}</h2>
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-200/70 px-2 text-xs font-semibold text-slate-500">{tasks.length}</span>
        </div>
        <button type="button" onClick={() => onAddTask(column)} aria-label={`افزودن تسک به ${column.title}`} title="افزودن تسک" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white/70 text-xl leading-none text-slate-600 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition hover:border-indigo-200 hover:bg-white hover:text-indigo-600">
          ＋
        </button>
      </header>

      <div className="flex min-h-28 flex-1 flex-col gap-3 overflow-y-auto px-1 pb-2 pt-1">
        {tasks.map((task, index) => (
          <TaskCard
            key={task.id}
            task={task}
            columnId={column.id}
            index={index}
            dragDisabled={dragDisabled}
            onEdit={onEditTask}
            onDelete={onDeleteTask}
          />
        ))}
        {tasks.length === 0 && (
          <div className="flex min-h-24 flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 px-4 text-center text-xs text-slate-400">
            {dragDisabled ? "فیلتر فعالی وجود ندارد" : "کارت را اینجا رها کنید یا تسک تازه بسازید"}
          </div>
        )}
      </div>
    </section>
  );
}
