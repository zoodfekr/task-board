use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager,
};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_notification::NotificationExt;

pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn setup(app: &App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "باز کردن Task Board", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "خروج کامل (توقف یادآوری‌ها)", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;

    // A small code-defined T icon works even without a bundled application icon.
    let mut rgba = vec![0_u8; 32 * 32 * 4];
    for y in 0..32 {
        for x in 0..32 {
            let offset = (y * 32 + x) * 4;
            let letter = (7..=11).contains(&y) && (6..=25).contains(&x)
                || (12..=25).contains(&y) && (13..=18).contains(&x);
            let color = if letter { [255, 255, 255, 255] } else { [79, 70, 229, 255] };
            rgba[offset..offset + 4].copy_from_slice(&color);
        }
    }
    TrayIconBuilder::with_id("tack-tray")
        .icon(Image::new_owned(rgba, 32, 32))
        .tooltip("Task Board — یادآوری‌ها در پس‌زمینه فعال هستند")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(event, TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            }) {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    if std::env::args().any(|arg| arg == "--background") {
        if let Some(window) = app.get_webview_window("main") {
            window.hide()?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn is_autostart_enabled(app: AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_autostart_enabled(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let manager = app.autolaunch();
    if enabled {
        manager.enable()
    } else {
        manager.disable()
    }.map_err(|error| error.to_string())?;
    manager.is_enabled().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn send_test_notification(app: AppHandle) -> Result<(), String> {
    app.notification().builder()
        .title("اعلان آزمایشی Task Board")
        .body("یادآوری‌ها حتی با پنجرهٔ بسته یا مینیمایز از اینجا نمایش داده می‌شوند.")
        .show()
        .map_err(|error| error.to_string())
}
