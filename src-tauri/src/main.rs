#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command]
fn kill_process(pid: u32) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::process::Command;
        Command::new("pkill")
            .args(["-KILL", "-P", &pid.to_string()])
            .spawn()
            .ok();
        Command::new("kill")
            .args(["-9", &pid.to_string()])
            .spawn()
            .ok();
        Command::new("pkill")
            .args(["-9", "-f", "yt-dlp"])
            .spawn()
            .ok();
    }
    #[cfg(windows)]
    {
        use std::process::Command;
        Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .spawn()
            .ok();
        Command::new("taskkill")
            .args(["/F", "/IM", "yt-dlp.exe"])
            .spawn()
            .ok();
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init()) // ← This was missing
        .invoke_handler(tauri::generate_handler![kill_process])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
