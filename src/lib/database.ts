import Database from "@tauri-apps/plugin-sql";
import type {
  CreateTaskInput,
  StickyNoteColor,
  Task,
  TaskColumn,
  TaskColumnId,
  TaskPriority,
  UpdateTaskInput,
} from "../types/task";

const DATABASE_URL = "sqlite:tack.db";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  columnId: string;
  priority: string;
  noteColor: string;
  groupName: string | null;
  dueAt: string | null;
  reminderAt: string | null;
  remindedAt: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

interface ColumnRow {
  id: string;
  title: string;
  position: number;
}

interface MaxPositionRow {
  maxPosition: number | null;
}

let databasePromise: Promise<Database> | null = null;

function getDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = Database.load(DATABASE_URL).then(async (db) => {
      const columns = await db.select<Array<{ name: string }>>("PRAGMA table_info(Tasks)");
      const names = new Set(columns.map((column) => column.name));
      if (!names.has("reminder_at")) await db.execute("ALTER TABLE Tasks ADD COLUMN reminder_at TEXT NULL");
      if (!names.has("reminded_at")) await db.execute("ALTER TABLE Tasks ADD COLUMN reminded_at TEXT NULL");
      const migrateGroups = !names.has("group_name");
      if (migrateGroups) {
        await db.execute("ALTER TABLE Tasks ADD COLUMN group_name TEXT NULL");

        const legacyRows = await db.select<Array<{ id: string; labelsJson: string; groupName: string | null }>>(
          "SELECT id, labels_json AS labelsJson, group_name AS groupName FROM Tasks WHERE group_name IS NULL",
        );
        for (const row of legacyRows) {
          let names: string[] = [];
          try {
            const parsed: unknown = JSON.parse(row.labelsJson);
            if (Array.isArray(parsed)) {
              names = parsed.flatMap((item: unknown) => {
                if (typeof item !== "object" || item === null) return [];
                const name = (item as Record<string, unknown>).name;
                return typeof name === "string" && name.trim() ? [name.trim()] : [];
              });
            }
          } catch {
            // Ignore malformed legacy label data and keep the task usable.
          }
          if (names.length) {
            await db.execute("UPDATE Tasks SET group_name = $1 WHERE id = $2", [names.join(", "), row.id]);
          }
        }
      }
      return db;
    }).catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

function isTaskColumnId(value: string): value is TaskColumnId {
  return value === "todo" || value === "in_progress" || value === "done";
}

function isTaskPriority(value: string): value is TaskPriority {
  return value === "low" || value === "normal" || value === "high" || value === "urgent";
}

function isStickyNoteColor(value: string): value is StickyNoteColor {
  return value === "yellow" || value === "pink" || value === "blue" ||
    value === "green" || value === "purple" || value === "orange";
}

function mapTask(row: TaskRow): Task {
  if (!isTaskColumnId(row.columnId)) throw new Error(`ستون نامعتبر در دیتابیس: ${row.columnId}`);
  if (!isTaskPriority(row.priority)) throw new Error(`اولویت نامعتبر در دیتابیس: ${row.priority}`);
  if (!isStickyNoteColor(row.noteColor)) throw new Error(`رنگ نامعتبر در دیتابیس: ${row.noteColor}`);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    columnId: row.columnId,
    priority: row.priority,
    noteColor: row.noteColor,
    groupName: row.groupName,
    dueAt: row.dueAt,
    reminderAt: row.reminderAt,
    remindedAt: row.remindedAt,
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function validateTitle(title: string): string {
  const normalized = title.trim();
  if (!normalized) throw new Error("عنوان تسک نمی‌تواند خالی باشد.");
  return normalized;
}

function validateGroupName(groupName: string | null | undefined): string | null {
  const normalized = groupName?.trim() ?? "";
  if (normalized.length > 80) throw new Error("نام گروه نمی‌تواند بیش از ۸۰ نویسه باشد.");
  return normalized || null;
}

async function nextPosition(columnId: TaskColumnId): Promise<number> {
  const db = await getDatabase();
  const rows = await db.select<MaxPositionRow[]>(
    "SELECT MAX(position) AS maxPosition FROM Tasks WHERE column_id = $1",
    [columnId],
  );
  return (rows[0]?.maxPosition ?? -1) + 1;
}

export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`تسک با شناسهٔ «${taskId}» پیدا نشد.`);
    this.name = "TaskNotFoundError";
  }
}

export async function getColumns(): Promise<TaskColumn[]> {
  const db = await getDatabase();
  const rows = await db.select<ColumnRow[]>(
    "SELECT id, title, position FROM Columns ORDER BY position ASC",
  );
  return rows.map((row) => {
    if (!isTaskColumnId(row.id)) throw new Error(`شناسهٔ ستون نامعتبر است: ${row.id}`);
    return { id: row.id, title: row.title, position: row.position };
  });
}

const TASK_SELECT = `
  SELECT Tasks.id AS id,
         Tasks.title AS title,
         Tasks.description AS description,
         Tasks.column_id AS columnId,
         Tasks.priority AS priority,
         Tasks.note_color AS noteColor,
         Tasks.group_name AS groupName,
         Tasks.due_at AS dueAt,
         Tasks.reminder_at AS reminderAt,
         Tasks.reminded_at AS remindedAt,
         Tasks.position AS position,
         Tasks.created_at AS createdAt,
         Tasks.updated_at AS updatedAt
  FROM Tasks
`;

export async function getTasks(): Promise<Task[]> {
  const db = await getDatabase();
  const rows = await db.select<TaskRow[]>(
    `${TASK_SELECT}
     INNER JOIN Columns AS c ON c.id = Tasks.column_id
     ORDER BY c.position ASC, Tasks.position ASC, Tasks.created_at ASC`,
  );
  return rows.map(mapTask);
}

export async function getTaskById(taskId: string): Promise<Task> {
  const db = await getDatabase();
  const rows = await db.select<TaskRow[]>(`${TASK_SELECT} WHERE Tasks.id = $1`, [taskId]);
  if (!rows[0]) throw new TaskNotFoundError(taskId);
  return mapTask(rows[0]);
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const db = await getDatabase();
  const id = crypto.randomUUID();
  const columnId = input.columnId ?? "todo";
  const now = new Date().toISOString();
  const position = await nextPosition(columnId);
  const groupName = validateGroupName(input.groupName);

  await db.execute(
    `INSERT INTO Tasks (
       id, title, description, column_id, priority, note_color, group_name, labels_json,
       due_at, reminder_at, reminded_at, position, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, '[]', $8, $9, $10, $11, $12, $13)`,
    [
      id,
      validateTitle(input.title),
      input.description ?? null,
      columnId,
      input.priority ?? "normal",
      input.noteColor ?? "yellow",
      groupName,
      input.dueAt ?? null,
      input.reminderAt ?? null,
      null,
      position,
      now,
      now,
    ],
  );
  return getTaskById(id);
}

export async function updateTask(taskId: string, input: UpdateTaskInput): Promise<Task> {
  const db = await getDatabase();
  const assignments: string[] = [];
  const values: unknown[] = [];
  const add = (column: string, value: unknown) => {
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  };

  if (input.title !== undefined) add("title", validateTitle(input.title));
  if (input.description !== undefined) add("description", input.description);
  if (input.priority !== undefined) add("priority", input.priority);
  if (input.noteColor !== undefined) add("note_color", input.noteColor);
  if (input.groupName !== undefined) add("group_name", validateGroupName(input.groupName));
  if (input.dueAt !== undefined) add("due_at", input.dueAt);
  if (input.reminderAt !== undefined) {
    const current = await getTaskById(taskId);
    if (input.reminderAt !== current.reminderAt) {
      add("reminder_at", input.reminderAt);
      add("reminded_at", null);
    }
  }
  if (input.remindedAt !== undefined) add("reminded_at", input.remindedAt);
  if (assignments.length === 0) return getTaskById(taskId);

  add("updated_at", new Date().toISOString());
  values.push(taskId);
  const result = await db.execute(
    `UPDATE Tasks SET ${assignments.join(", ")} WHERE id = $${values.length}`,
    values,
  );
  if (result.rowsAffected === 0) throw new TaskNotFoundError(taskId);
  return getTaskById(taskId);
}

export async function deleteTask(taskId: string): Promise<void> {
  const db = await getDatabase();
  const result = await db.execute("DELETE FROM Tasks WHERE id = $1", [taskId]);
  if (result.rowsAffected === 0) throw new TaskNotFoundError(taskId);
}

export interface BoardOrderEntry {
  taskId: string;
  columnId: TaskColumnId;
  position: number;
}

/** ذخیرهٔ ترتیب کامل بورد با یک دستور SQL اتمیک. */
export async function saveBoardOrder(entries: readonly BoardOrderEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const db = await getDatabase();
  const values: unknown[] = [];
  const columnCases: string[] = [];
  const positionCases: string[] = [];
  const ids: string[] = [];

  for (const entry of entries) {
    if (!Number.isInteger(entry.position) || entry.position < 0) {
      throw new Error(`موقعیت کارت نامعتبر است: ${entry.position}`);
    }
    const idPlaceholder = `$${values.length + 1}`;
    values.push(entry.taskId);
    const columnPlaceholder = `$${values.length + 1}`;
    values.push(entry.columnId);
    const positionPlaceholder = `$${values.length + 1}`;
    values.push(entry.position);
    columnCases.push(`WHEN ${idPlaceholder} THEN ${columnPlaceholder}`);
    positionCases.push(`WHEN ${idPlaceholder} THEN ${positionPlaceholder}`);
    ids.push(idPlaceholder);
  }

  const timestampPlaceholder = `$${values.length + 1}`;
  values.push(new Date().toISOString());
  const columnCase = `CASE id ${columnCases.join(" ")} ELSE column_id END`;
  const positionCase = `CASE id ${positionCases.join(" ")} ELSE position END`;

  const result = await db.execute(
    `UPDATE Tasks
     SET column_id = ${columnCase},
         position = ${positionCase},
         updated_at = CASE
           WHEN column_id != ${columnCase} OR position != ${positionCase}
           THEN ${timestampPlaceholder}
           ELSE updated_at
         END
     WHERE id IN (${ids.join(", ")})`,
    values,
  );

  if (result.rowsAffected !== entries.length) {
    throw new Error("ذخیرهٔ ترتیب انجام نشد؛ یک یا چند تسک در دیتابیس وجود ندارد.");
  }
}
