use base64::Engine;
use std::path::PathBuf;

#[tauri::command]
fn write_binary_file(path: String, base64: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    if !path.is_absolute() {
        return Err("Save path must be absolute".to_string());
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64)
        .map_err(|error| format!("Cannot decode PNG: {error}"))?;
    std::fs::write(path, bytes).map_err(|error| format!("Cannot save PNG: {error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![write_binary_file])
        .run(tauri::generate_context!())
        .expect("failed to run 生成器");
}

#[cfg(test)]
mod tests {
    use super::write_binary_file;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temporary_png_path() -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time must be after Unix epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("atgenerator-{nonce}.png"))
    }

    #[test]
    fn rejects_relative_save_paths() {
        let error = write_binary_file("qrcode.png".to_string(), "iVBORw0KGgo=".to_string())
            .expect_err("relative paths must be rejected");

        assert_eq!(error, "Save path must be absolute");
    }

    #[test]
    fn decodes_and_writes_png_bytes() {
        let path = temporary_png_path();

        write_binary_file(
            path.to_string_lossy().into_owned(),
            "iVBORw0KGgo=".to_string(),
        )
        .expect("valid PNG data should be written");

        assert_eq!(std::fs::read(&path).expect("saved PNG should exist"), b"\x89PNG\r\n\x1a\n");
        std::fs::remove_file(path).expect("temporary PNG should be removable");
    }

    #[test]
    fn rejects_invalid_base64() {
        let path = temporary_png_path();

        let error = write_binary_file(path.to_string_lossy().into_owned(), "%%%".to_string())
            .expect_err("invalid base64 must be rejected");

        assert!(error.starts_with("Cannot decode PNG:"));
        assert!(!path.exists());
    }
}
