use std::time::Duration;
use serde::Serialize;
use sqlx::{Row, SqlitePool};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_sql::{DbInstances, DbPool};

const DATABASE_URL: &str = "sqlite:tack.db";
const POLL_INTERVAL: Duration = Duration::from_secs(15);
const SELECT_DUE: &str = "SELECT id FROM Tasks
    WHERE reminder_at IS NOT NULL AND reminded_at IS NULL
      AND julianday(reminder_at) <= julianday('now')
    ORDER BY julianday(reminder_at), id";
const CLAIM_DUE: &str = "UPDATE Tasks
    SET reminded_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?1 AND reminded_at IS NULL
      AND julianday(reminder_at) <= julianday('now')
    RETURNING id, title, reminder_at, reminded_at";
const SAVE_DELIVERY: &str = "INSERT INTO ReminderDeliveries
    (task_id, reminder_at, delivered_at, dismissed_at) VALUES (?1, ?2, ?3, NULL)
    ON CONFLICT(task_id, reminder_at) DO UPDATE SET
      delivered_at = excluded.delivered_at, dismissed_at = NULL";
const SELECT_INBOX: &str = "SELECT d.task_id, d.reminder_at, d.delivered_at
    FROM ReminderDeliveries d INNER JOIN Tasks t ON t.id = d.task_id
    WHERE d.dismissed_at IS NULL AND t.reminder_at = d.reminder_at
      AND t.reminded_at IS NOT NULL
    ORDER BY d.delivered_at DESC, d.task_id";
const DISMISS_DELIVERY: &str = "UPDATE ReminderDeliveries
    SET dismissed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE task_id = ?1 AND reminder_at = ?2";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReminderDelivery {
    task_id: String,
    reminder_at: String,
    delivered_at: String,
}

async fn database(app: &AppHandle) -> Result<SqlitePool, String> {
    // Reuse the plugin's pool: the scheduler and the board always use the same DB.
    let instances = app.state::<DbInstances>();
    let pools = instances.0.read().await;
    match pools.get(DATABASE_URL) {
        Some(DbPool::Sqlite(pool)) => Ok(pool.clone()),
        _ => Err("دیتابیس یادآوری‌ها در دسترس نیست.".into()),
    }
}

async fn deliver_due(app: &AppHandle, pool: &SqlitePool) -> Result<(), String> {
    let due = sqlx::query(SELECT_DUE).fetch_all(pool).await
        .map_err(|error| error.to_string())?;
    for row in due {
        let id: String = row.get("id");
        let mut tx = pool.begin().await.map_err(|error| error.to_string())?;
        // Claim under a write lock and recheck the current reminder. A task may
        // have been deleted, edited, or postponed since SELECT_DUE was executed.
        let claimed = sqlx::query(CLAIM_DUE).bind(&id)
            .fetch_optional(&mut *tx).await.map_err(|error| error.to_string())?;
        let Some(row) = claimed else {
            tx.rollback().await.map_err(|error| error.to_string())?;
            continue;
        };
        let delivery = ReminderDelivery {
            task_id: id,
            reminder_at: row.get("reminder_at"),
            delivered_at: row.get("reminded_at"),
        };
        sqlx::query(SAVE_DELIVERY)
            .bind(&delivery.task_id).bind(&delivery.reminder_at).bind(&delivery.delivered_at)
            .execute(&mut *tx).await.map_err(|error| error.to_string())?;
        tx.commit().await.map_err(|error| error.to_string())?;
        let _ = app.emit("reminder-delivered", &delivery);
        // Windows owns the look of native toast banners. Use Tack's own small
        // WebView window when the board is hidden so the reminder keeps its UI.
        let main_is_visible = app.get_webview_window("main")
            .and_then(|window| window.is_visible().ok().map(|visible| {
                visible && !window.is_minimized().unwrap_or(false)
            }))
            .unwrap_or(false);
        if !main_is_visible {
            crate::desktop::show_reminder_window(app);
        }
    }
    Ok(())
}

pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(POLL_INTERVAL);
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let mut last_error: Option<String> = None;
        loop {
            interval.tick().await;
            let result = match database(&app).await {
                Ok(pool) => deliver_due(&app, &pool).await,
                Err(error) => Err(error),
            };
            let error = result.err();
            if error != last_error {
                if let Some(message) = &error {
                    eprintln!("Task Board reminder error: {message}");
                }
                let _ = app.emit("reminder-service-error", &error);
                last_error = error;
            }
        }
    });
}

#[tauri::command]
pub async fn get_reminder_inbox(app: AppHandle) -> Result<Vec<ReminderDelivery>, String> {
    let pool = database(&app).await?;
    let rows = sqlx::query(SELECT_INBOX).fetch_all(&pool).await
        .map_err(|error| error.to_string())?;
    Ok(rows.into_iter().map(|row| ReminderDelivery {
        task_id: row.get("task_id"),
        reminder_at: row.get("reminder_at"),
        delivered_at: row.get("delivered_at"),
    }).collect())
}

#[tauri::command]
pub async fn dismiss_reminder(app: AppHandle, task_id: String, reminder_at: String) -> Result<(), String> {
    let pool = database(&app).await?;
    sqlx::query(DISMISS_DELIVERY).bind(task_id).bind(reminder_at)
        .execute(&pool).await.map_err(|error| error.to_string())?;
    Ok(())
}
