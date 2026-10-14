import { useRef, useState } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { move } from "@dnd-kit/helpers";
import type { CreateTaskInput, Task, TaskColumn, TaskColumnId } from "../../types/task";
import { BoardHeader, type ColorFilter, type GroupFilter, type PriorityFilter } from "./BoardHeader";
import { KanbanColumn } from "./KanbanColumn";
import { TaskDialog } from "./TaskDialog";
import { ReminderMonitor } from "./ReminderMonitor";

type PreviewBoardState = Record<TaskColumnId, Task[]>;
const timestamp = new Date().toISOString();
const dateIn = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
const sampleTasks: Task[] = [
  {
    id: "sample-brief", title: "نهایی‌کردن بریف محصول", description: "نسخهٔ نهایی را با تیم طراحی مرور کنیم.",
    columnId: "todo", priority: "urgent", noteColor: "yellow", groupName: "انتشار",
    dueAt: dateIn(3), reminderAt: null, remindedAt: null, position: 0, createdAt: timestamp, updatedAt: timestamp,
  },
  {
    id: "sample-hiring", title: "برنامه‌ریزی جذب نیرو", description: "نیازهای تیم برای فصل بعد را جمع‌بندی کن.",
    columnId: "todo", priority: "normal", noteColor: "pink", groupName: "تیم",
    dueAt: dateIn(5), reminderAt: null, remindedAt: null, position: 1, createdAt: timestamp, updatedAt: timestamp,
  },
  {
    id: "sample-dashboard", title: "بازبینی داشبورد شاخص‌ها", description: "نرخ تبدیل و زمان پاسخ را بررسی کن.",
    columnId: "in_progress", priority: "high", noteColor: "blue", groupName: "داده",
    dueAt: dateIn(2), reminderAt: null, remindedAt: null, position: 0, createdAt: timestamp, updatedAt: timestamp,
  },
  {
    id: "sample-ideas", title: "ایده‌های جلسهٔ مشتریان", description: "سه ایده برای ساده‌کردن ورود کاربران.",
    columnId: "in_progress", priority: "low", noteColor: "green", groupName: "ایده",
    dueAt: dateIn(4), reminderAt: null, remindedAt: null, position: 1, createdAt: timestamp, updatedAt: timestamp,
  },
  {
    id: "sample-release", title: "ارسال یادداشت انتشار", description: null,
    columnId: "done", priority: "normal", noteColor: "purple", groupName: "تکمیل‌شده",
    dueAt: dateIn(-1), reminderAt: null, remindedAt: null, position: 0, createdAt: timestamp, updatedAt: timestamp,
  },
];

const columns: TaskColumn[] = [
  { id: "todo", title: "برای انجام", position: 0 },
  { id: "in_progress", title: "در حال انجام", position: 1 },
  { id: "done", title: "انجام‌شده", position: 2 },
];

function groupTasks(tasks: readonly Task[]): PreviewBoardState {
  const grouped: PreviewBoardState = { todo: [], in_progress: [], done: [] };
  for (const task of tasks) grouped[task.columnId].push(task);
  return grouped;
}

export function PreviewBoard() {
  const [board, setBoard] = useState<PreviewBoardState>(() => groupTasks(sampleTasks));
  const boardRef = useRef(board);
  const snapshotRef = useRef(board);
  const [colorFilter, setColorFilter] = useState<ColorFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [targetColumn, setTargetColumn] = useState<TaskColumnId>("todo");
  const groups = [...new Set(Object.values(board).flat().map((task) => task.groupName).filter((group): group is string => Boolean(group)))].sort((a, b) => a.localeCompare(b, "fa"));
  const filtered = colorFilter !== "all" || priorityFilter !== "all" || groupFilter !== null || searchQuery.trim().length > 0;

  function commit(next: PreviewBoardState): void {
    boardRef.current = next;
    setBoard(next);
  }

  function openCreate(columnId: TaskColumnId = "todo"): void {
    setEditingTask(null);
    setTargetColumn(columnId);
    setDialogOpen(true);
  }

  async function savePreviewTask(input: CreateTaskInput): Promise<void> {
    const current = boardRef.current;
    if (editingTask) {
      const edited: Task = {
        ...editingTask,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? editingTask.priority,
        noteColor: input.noteColor ?? editingTask.noteColor,
        groupName: input.groupName ?? null,
        reminderAt: input.reminderAt ?? null,
        remindedAt: input.reminderAt === editingTask.reminderAt ? editingTask.remindedAt : null,
        updatedAt: new Date().toISOString(),
      };
      const next: PreviewBoardState = {
        todo: current.todo.map((task) => task.id === edited.id ? edited : task),
        in_progress: current.in_progress.map((task) => task.id === edited.id ? edited : task),
        done: current.done.map((task) => task.id === edited.id ? edited : task),
      };
      commit(next);
    } else {
      const now = new Date().toISOString();
      const task: Task = {
        id: crypto.randomUUID(),
        title: input.title,
        description: input.description ?? null,
        columnId: targetColumn,
        priority: input.priority ?? "normal",
        noteColor: input.noteColor ?? "yellow",
        groupName: input.groupName ?? null,
        dueAt: input.dueAt ?? null,
        reminderAt: input.reminderAt ?? null,
        remindedAt: null,
        position: current[targetColumn].length,
        createdAt: now,
        updatedAt: now,
      };
      commit({ ...current, [targetColumn]: [...current[targetColumn], task] });
    }
    setDialogOpen(false);
    setEditingTask(null);
  }

  function removePreviewTask(task: Task): void {
    if (!window.confirm(`تسک «${task.title}» حذف شود؟`)) return;
    const current = boardRef.current;
    commit({
      todo: current.todo.filter((item) => item.id !== task.id),
      in_progress: current.in_progress.filter((item) => item.id !== task.id),
      done: current.done.filter((item) => item.id !== task.id),
    });
  }

  return (
    <div className="tack-app-shell h-dvh w-full overflow-hidden bg-[#f5f6fa]">
    <main dir="rtl" className="tack-main flex h-full min-h-0 w-full flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-center bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white">
        پیش‌نمایش تعاملی — تغییرات این پنجره در دیتابیس ذخیره نمی‌شوند
      </div>
      <BoardHeader
        colorFilter={colorFilter}
        priorityFilter={priorityFilter}
        groupFilter={groupFilter}
        groups={groups}
        searchQuery={searchQuery}
        onColorFilterChange={setColorFilter}
        onPriorityFilterChange={setPriorityFilter}
        onGroupFilterChange={setGroupFilter}
        onSearchQueryChange={setSearchQuery}
        onAddTask={() => openCreate()}
        windowControlsEnabled={false}
      />
      <ReminderMonitor
        tasks={Object.values(board).flat()}
        onAcknowledge={(taskId, acknowledgedAt) => {
          const current = boardRef.current;
          commit({
            todo: current.todo.map((task) => task.id === taskId ? { ...task, remindedAt: acknowledgedAt } : task),
            in_progress: current.in_progress.map((task) => task.id === taskId ? { ...task, remindedAt: acknowledgedAt } : task),
            done: current.done.map((task) => task.id === taskId ? { ...task, remindedAt: acknowledgedAt } : task),
          });
        }}
        onReschedule={(taskId, reminderAt) => {
          const current = boardRef.current;
          const rescheduled = (task: Task): Task => task.id === taskId
            ? { ...task, reminderAt, remindedAt: null, updatedAt: new Date().toISOString() }
            : task;
          commit({
            todo: current.todo.map(rescheduled),
            in_progress: current.in_progress.map(rescheduled),
            done: current.done.map(rescheduled),
          });
        }}
      />

      {filtered && <p className="px-5 pt-3 text-xs text-slate-500">برای جابه‌جایی کارت‌ها، فیلترها را روی «همه» بگذارید.</p>}

      <DragDropProvider
        onDragStart={() => {
          const current = boardRef.current;
          snapshotRef.current = {
            todo: [...current.todo],
            in_progress: [...current.in_progress],
            done: [...current.done],
          };
        }}
        onDragOver={(event) => commit(move(boardRef.current, event) as PreviewBoardState)}
        onDragEnd={(event) => {
          if (event.canceled) commit(snapshotRef.current);
        }}
      >
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-3 py-3">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={board[column.id].filter((task) =>
                (colorFilter === "all" || task.noteColor === colorFilter) &&
                (priorityFilter === "all" || task.priority === priorityFilter) &&
                (groupFilter === null || task.groupName === groupFilter) &&
                (!searchQuery.trim() || [task.title, task.description ?? "", task.groupName ?? ""]
                  .some((value) => value.toLocaleLowerCase("fa").includes(searchQuery.trim().toLocaleLowerCase("fa")))),
              )}
              dragDisabled={filtered}
              onAddTask={(target) => openCreate(target.id)}
              onEditTask={(task) => { setEditingTask(task); setTargetColumn(task.columnId); setDialogOpen(true); }}
              onDeleteTask={removePreviewTask}
            />
          ))}
        </div>
      </DragDropProvider>

      {dialogOpen && (
        <TaskDialog
          initialTask={editingTask}
          initialColumnId={targetColumn}
          onClose={() => { setDialogOpen(false); setEditingTask(null); }}
          onSave={savePreviewTask}
        />
      )}
    </main>
    </div>
  );
}
