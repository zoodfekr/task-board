export const TASK_COLUMN_IDS = ["todo", "in_progress", "done"] as const;

export type TaskColumnId = (typeof TASK_COLUMN_IDS)[number];

export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const STICKY_NOTE_COLORS = [
  "yellow",
  "pink",
  "blue",
  "green",
  "purple",
  "orange",
] as const;
export type StickyNoteColor = (typeof STICKY_NOTE_COLORS)[number];

export interface TaskColumn {
  id: TaskColumnId;
  title: string;
  position: number;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  columnId: TaskColumnId;
  priority: TaskPriority;
  noteColor: StickyNoteColor;
  groupName: string | null;
  dueAt: string | null;
  reminderAt: string | null;
  remindedAt: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  columnId?: TaskColumnId;
  priority?: TaskPriority;
  noteColor?: StickyNoteColor;
  groupName?: string | null;
  dueAt?: string | null;
  reminderAt?: string | null;
}

export type UpdateTaskInput = Partial<
  Pick<Task, "title" | "description" | "priority" | "noteColor" | "groupName" | "dueAt" | "reminderAt" | "remindedAt">
>;
