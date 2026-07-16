#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

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

#[tauri::command]
fn get_exe_dir(app: tauri::AppHandle) -> Result<String, String> {
    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    if !cache_dir.exists() {
        std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;
    }

    // Tauri bundles sidecars next to the running executable under their BARE name
    // (the target triple is stripped from the filename after placement).
    // We look for the bare ffmpeg/ffprobe there and copy it into the app cache dir
    // so yt-dlp can be pointed at a stable --ffmpeg-location.
    let (ffmpeg_name, ffprobe_name) = if cfg!(windows) {
        ("ffmpeg.exe", "ffprobe.exe")
    } else {
        ("ffmpeg", "ffprobe")
    };

    let exe_dir = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or_else(|| "Failed to resolve executable parent directory".to_string())?
        .to_path_buf();

    let ffmpeg_src = exe_dir.join(ffmpeg_name);
    let ffprobe_src = exe_dir.join(ffprobe_name);

    if !ffmpeg_src.exists() {
        return Err(format!(
            "ffmpeg sidecar not found next to executable at {}",
            ffmpeg_src.display()
        ));
    }
    if !ffprobe_src.exists() {
        return Err(format!(
            "ffprobe sidecar not found next to executable at {}",
            ffprobe_src.display()
        ));
    }

    let ffmpeg_dest = cache_dir.join(ffmpeg_name);
    let ffprobe_dest = cache_dir.join(ffprobe_name);

    let copy_if_needed = |src: &std::path::Path, dest: &std::path::Path| -> Result<(), String> {
        let should_copy = if dest.exists() {
            let src_len = std::fs::metadata(src).map(|m| m.len()).ok();
            let dest_len = std::fs::metadata(dest).map(|m| m.len()).ok();
            src_len != dest_len
        } else {
            true
        };
        if should_copy {
            std::fs::copy(src, dest).map_err(|e| e.to_string())?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = std::fs::metadata(dest).map_err(|e| e.to_string())?.permissions();
                perms.set_mode(0o755);
                std::fs::set_permissions(dest, perms).map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    };

    copy_if_needed(&ffmpeg_src, &ffmpeg_dest)?;
    copy_if_needed(&ffprobe_src, &ffprobe_dest)?;

    Ok(cache_dir.to_string_lossy().to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![kill_process, get_exe_dir])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
