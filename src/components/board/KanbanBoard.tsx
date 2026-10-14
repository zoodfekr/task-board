import { useEffect, useRef, useState } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { move } from "@dnd-kit/helpers";
import { createTask, deleteTask, getColumns, getTasks, saveBoardOrder, updateTask } from "../../lib/database";
import type { CreateTaskInput, Task, TaskColumn, TaskColumnId } from "../../types/task";
import { BoardHeader, type ColorFilter, type GroupFilter, type PriorityFilter } from "./BoardHeader";
import { KanbanColumn } from "./KanbanColumn";
import { TaskDialog } from "./TaskDialog";
import { ReminderMonitor } from "./ReminderMonitor";
import { onReminderDelivered } from "../../lib/reminders";

type BoardState = Record<TaskColumnId, Task[]>;
const emptyBoard = (): BoardState => ({ todo: [], in_progress: [], done: [] });

function groupTasks(tasks: readonly Task[]): BoardState {
  const grouped = emptyBoard();
  for (const task of tasks) grouped[task.columnId].push(task);
  for (const id of Object.keys(grouped) as TaskColumnId[]) {
    grouped[id].sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
  }
  return grouped;
}

function orderEntries(board: BoardState) {
  return (Object.keys(board) as TaskColumnId[]).flatMap((columnId) =>
    board[columnId].map((task, position) => ({ taskId: task.id, columnId, position })),
  );
}

export function KanbanBoard() {
  const [columns, setColumns] = useState<TaskColumn[]>([]);
  const [board, setBoard] = useState<BoardState>(emptyBoard);
  const boardRef = useRef<BoardState>(emptyBoard());
  const dragSnapshotRef = useRef<BoardState>(emptyBoard());
  const savingOrderRef = useRef(false);
  const [colorFilter, setColorFilter] = useState<ColorFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTask, setDialogTask] = useState<Task | null>(null);
  const [dialogColumnId, setDialogColumnId] = useState<TaskColumnId>("todo");
  const [loading, setLoading] = useState(true);
  const [savingOrder, setSavingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groups = [...new Set(Object.values(board).flat().map((task) => task.groupName).filter((group): group is string => Boolean(group)))].sort((a, b) => a.localeCompare(b, "fa"));
  const filtered = colorFilter !== "all" || priorityFilter !== "all" || groupFilter !== null || searchQuery.trim().length > 0;

  useEffect(() => {
    let alive = true;
    async function load(): Promise<void> {
      try {
        const [nextColumns, nextTasks] = await Promise.all([getColumns(), getTasks()]);
        if (!alive) return;
        const nextBoard = groupTasks(nextTasks);
        boardRef.current = nextBoard;
        setBoard(nextBoard);
        setColumns(nextColumns);
      } catch (loadError) {
        if (alive) setError(loadError instanceof Error ? loadError.message : "بارگذاری بورد ناموفق بود.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => { alive = false; };
  }, []);

  function commit(next: BoardState): void {
    boardRef.current = next;
    setBoard(next);
  }

  useEffect(() => {
    let alive = true;
    let unlisten: (() => void) | undefined;
    void onReminderDelivered((delivery) => {
      if (!alive) return;
      const current = boardRef.current;
      const update = (task: Task): Task => task.id === delivery.taskId && task.reminderAt === delivery.reminderAt
        ? { ...task, remindedAt: delivery.deliveredAt }
        : task;
      commit({ todo: current.todo.map(update), in_progress: current.in_progress.map(update), done: current.done.map(update) });
    }).then((stop) => {
      if (alive) unlisten = stop;
      else stop();
    }).catch(() => {
      if (alive) setError("دریافت وضعیت یادآوری‌ها از ویندوز انجام نشد.");
    });
    return () => { alive = false; unlisten?.(); };
  }, []);

  function openCreate(columnId: TaskColumnId = "todo"): void {
    setDialogTask(null);
    setDialogColumnId(columnId);
    setDialogOpen(true);
  }

  async function saveTask(input: CreateTaskInput): Promise<void> {
    setError(null);
    if (dialogTask) {
      const saved = await updateTask(dialogTask.id, {
        title: input.title,
        description: input.description,
        priority: input.priority,
        noteColor: input.noteColor,
        groupName: input.groupName,
        dueAt: input.dueAt,
        reminderAt: input.reminderAt,
      });
      const next = { ...boardRef.current };
      next[saved.columnId] = next[saved.columnId].map((task) => task.id === saved.id ? saved : task);
      commit(next);
    } else {
      const created = await createTask({ ...input, columnId: dialogColumnId });
      const next = { ...boardRef.current };
      next[created.columnId] = [...next[created.columnId], created];
      commit(next);
    }
    setDialogOpen(false);
    setDialogTask(null);
  }

  async function removeTask(task: Task): Promise<void> {
    if (!window.confirm(`تسک «${task.title}» حذف شود؟`)) return;
    setError(null);
    try {
      await deleteTask(task.id);
      const current = boardRef.current;
      const next: BoardState = {
        todo: current.todo.filter((item) => item.id !== task.id),
        in_progress: current.in_progress.filter((item) => item.id !== task.id),
        done: current.done.filter((item) => item.id !== task.id),
      };
      commit(next);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "حذف تسک ناموفق بود.");
    }
  }

  async function acknowledgeReminder(taskId: string, acknowledgedAt: string): Promise<void> {
    const saved = await updateTask(taskId, { remindedAt: acknowledgedAt });
    const next = { ...boardRef.current };
    next[saved.columnId] = next[saved.columnId].map((task) => task.id === saved.id ? saved : task);
    commit(next);
  }

  async function rescheduleReminder(taskId: string, reminderAt: string): Promise<void> {
    const saved = await updateTask(taskId, { reminderAt });
    const next = { ...boardRef.current };
    next[saved.columnId] = next[saved.columnId].map((task) => task.id === saved.id ? saved : task);
    commit(next);
  }

  function handleDragOver(event: Parameters<NonNullable<React.ComponentProps<typeof DragDropProvider>["onDragOver"]>>[0]): void {
    if (savingOrderRef.current) return;
    const next = move(boardRef.current, event) as BoardState;
    commit(next);
  }

  async function handleDragEnd(event: Parameters<NonNullable<React.ComponentProps<typeof DragDropProvider>["onDragEnd"]>>[0]): Promise<void> {
    if (savingOrderRef.current) return;
    if (event.canceled) {
      commit(dragSnapshotRef.current);
      return;
    }

    savingOrderRef.current = true;
    const boardBeingSaved = boardRef.current;
    setSavingOrder(true);
    setError(null);
    try {
      await saveBoardOrder(orderEntries(boardBeingSaved));
    } catch (saveError) {
      try {
        commit(groupTasks(await getTasks()));
      } catch {
        if (boardRef.current === boardBeingSaved) commit(dragSnapshotRef.current);
      }
      setError(saveError instanceof Error ? `ذخیرهٔ ترتیب کارت‌ها ناموفق بود: ${saveError.message}` : "ذخیرهٔ ترتیب کارت‌ها ناموفق بود.");
    } finally {
      savingOrderRef.current = false;
      setSavingOrder(false);
    }
  }

  return (
    <div className="tack-app-shell h-dvh w-full overflow-hidden bg-[#f5f6fa]">
    <main dir="rtl" className="tack-main flex h-full min-h-0 w-full flex-col overflow-hidden bg-white">
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
        onAddTask={() => openCreate("todo")}
      />
      <ReminderMonitor tasks={Object.values(board).flat()} onAcknowledge={acknowledgeReminder} onReschedule={rescheduleReminder} />
      {error && <div role="alert" className="mx-5 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {savingOrder && <p role="status" className="px-5 pt-3 text-xs text-slate-500">در حال ذخیرهٔ ترتیب کارت‌ها...</p>}

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">در حال بارگذاری بورد...</div>
      ) : (
        <DragDropProvider
          onDragStart={() => {
            if (savingOrderRef.current) return;
            dragSnapshotRef.current = {
              todo: [...boardRef.current.todo],
              in_progress: [...boardRef.current.in_progress],
              done: [...boardRef.current.done],
            };
          }}
          onDragOver={handleDragOver}
          onDragEnd={(event) => void handleDragEnd(event)}
        >
          <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-3 py-3">
            {columns.map((column) => {
              const visibleTasks = board[column.id].filter((task) =>
                (colorFilter === "all" || task.noteColor === colorFilter) &&
                (priorityFilter === "all" || task.priority === priorityFilter) &&
                (groupFilter === null || task.groupName === groupFilter) &&
                (!searchQuery.trim() || [task.title, task.description ?? "", task.groupName ?? ""]
                  .some((value) => value.toLocaleLowerCase("fa").includes(searchQuery.trim().toLocaleLowerCase("fa")))),
              );
              return (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={visibleTasks}
                  dragDisabled={filtered || savingOrder}
                  onAddTask={(target) => openCreate(target.id)}
                  onEditTask={(task) => { setDialogTask(task); setDialogColumnId(task.columnId); setDialogOpen(true); }}
                  onDeleteTask={(task) => void removeTask(task)}
                />
              );
            })}
          </div>
        </DragDropProvider>
      )}

      {filtered && !loading && <p className="px-5 pb-3 text-xs text-slate-500">برای جابه‌جایی کارت‌ها، فیلترها را روی «همه» بگذارید.</p>}
      {dialogOpen && (
        <TaskDialog
          initialTask={dialogTask}
          initialColumnId={dialogColumnId}
          onClose={() => { setDialogOpen(false); setDialogTask(null); }}
          onSave={saveTask}
        />
      )}
    </main>
    </div>
  );
}
