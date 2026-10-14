use tauri_plugin_sql::{Migration, MigrationKind};

mod reminders;
mod desktop;

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_columns_table",
            sql: "CREATE TABLE IF NOT EXISTS Columns (
                id TEXT PRIMARY KEY NOT NULL,
                title TEXT NOT NULL,
                position INTEGER NOT NULL UNIQUE
            )",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_tasks_table",
            sql: "CREATE TABLE IF NOT EXISTS Tasks (
                id TEXT PRIMARY KEY NOT NULL,
                title TEXT NOT NULL CHECK (length(trim(title)) > 0),
                description TEXT NULL,
                column_id TEXT NOT NULL REFERENCES Columns(id) ON UPDATE CASCADE ON DELETE RESTRICT,
                priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
                note_color TEXT NOT NULL DEFAULT 'yellow' CHECK (note_color IN ('yellow', 'pink', 'blue', 'green', 'purple', 'orange')),
                labels_json TEXT NOT NULL DEFAULT '[]',
                group_name TEXT NULL,
                due_at TEXT NULL,
                reminder_at TEXT NULL,
                reminded_at TEXT NULL,
                position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "seed_default_columns",
            sql: "INSERT OR IGNORE INTO Columns (id, title, position) VALUES
                ('todo', 'برای انجام', 0),
                ('in_progress', 'در حال انجام', 1),
                ('done', 'انجام‌شده', 2)",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "index_tasks_by_column_and_position",
            sql: "CREATE INDEX IF NOT EXISTS idx_tasks_column_position ON Tasks(column_id, position)",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "persist_reminder_inbox",
            sql: "CREATE TABLE IF NOT EXISTS ReminderDeliveries (
                task_id TEXT NOT NULL REFERENCES Tasks(id) ON DELETE CASCADE,
                reminder_at TEXT NOT NULL,
                delivered_at TEXT NOT NULL,
                dismissed_at TEXT NULL,
                PRIMARY KEY (task_id, reminder_at)
            )",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "index_tasks_pending_reminders",
            sql: "CREATE INDEX IF NOT EXISTS idx_tasks_pending_reminders
                ON Tasks(reminder_at) WHERE reminded_at IS NULL",
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            desktop::show_main_window(app);
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--background"]),
        ))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:tack.db", migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            reminders::get_reminder_inbox,
            reminders::dismiss_reminder,
            desktop::is_autostart_enabled,
            desktop::set_autostart_enabled,
            desktop::send_test_notification,
        ])
        .setup(|app| {
            desktop::setup(app)?;
            reminders::start(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    // Only hide if the window can be restored through the tray.
                    if window.hide().is_ok() {
                        api.prevent_close();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to run Tack desktop application");
}
