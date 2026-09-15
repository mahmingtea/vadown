import { invoke } from "@tauri-apps/api/core";

export interface DownloadHistoryItem {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  format: "video" | "audio";
  selectedFormat?: string;
  quality?: string;
  filePath: string;
  fileName: string;
  fileSize?: number;
  timestamp: number;
  isPlaylist: boolean;
  itemCount?: number;
  selectedItems?: number[];
  playlistQuality?: "highest" | "medium" | "low";
}

export interface DiskStatus {
  exists: boolean;
  is_dir: boolean;
  size?: number;
}

const STORAGE_KEY = "vadown_download_history";
const EVENT_NAME = "vadown:history-updated";

export function isSafeHistoryItem(item: any): boolean {
  if (!item || typeof item.filePath !== "string" || !item.filePath.trim()) {
    return false;
  }
  const clean = item.filePath.trim().replace(/[/\\]+$/, "");
  const cleanLower = clean.toLowerCase();

  if (
    clean === "" ||
    clean === "/" ||
    cleanLower.endsWith("/downloads") ||
    cleanLower.endsWith("\\downloads") ||
    cleanLower.endsWith("/desktop") ||
    cleanLower.endsWith("/documents") ||
    item.fileName === "Downloads"
  ) {
    return false;
  }

  if (!item.isPlaylist && !/\.[a-zA-Z0-9]{2,5}$/.test(clean)) {
    return false;
  }

  return true;
}

export function loadHistory(): DownloadHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const sanitized = parsed.filter(isSafeHistoryItem);
      if (sanitized.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      }
      return sanitized;
    }
    return [];
  } catch (err) {
    console.error("Failed to load history from localStorage:", err);
    return [];
  }
}

export function saveHistory(items: DownloadHistoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: items }));
  } catch (err) {
    console.error("Failed to save history to localStorage:", err);
  }
}

export function addHistoryItem(
  item: Omit<DownloadHistoryItem, "id" | "timestamp"> & {
    id?: string;
    timestamp?: number;
  }
): DownloadHistoryItem | null {
  if (!isSafeHistoryItem(item)) {
    console.warn("Refusing to add unsafe history item:", item);
    return null;
  }
  const current = loadHistory();

  // If this is a redownload or re-fetch of an existing item:
  // Find by existing id, or matching same url + format + playlist mode
  const existingIndex = item.id
    ? current.findIndex((i) => i.id === item.id)
    : current.findIndex(
        (i) => i.url === item.url && i.format === item.format && i.isPlaylist === item.isPlaylist
      );

  if (existingIndex !== -1) {
    const existing = current[existingIndex];
    const updatedItem: DownloadHistoryItem = {
      ...existing,
      ...item,
      id: existing.id,
      timestamp: Date.now(),
    };

    // Update in-place so it maintains its slot on the list
    const updated = [...current];
    updated[existingIndex] = updatedItem;
    // Deduplicate any stray entries with the same filePath or id
    const deduplicated = updated.filter(
      (it, idx) => idx === existingIndex || (it.filePath !== updatedItem.filePath && it.id !== updatedItem.id)
    );
    saveHistory(deduplicated);
    return updatedItem;
  }

  const newItem: DownloadHistoryItem = {
    ...item,
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: item.timestamp || Date.now(),
  };

  // Prepend so latest downloads appear at the top
  const updated = [newItem, ...current.filter((i) => i.filePath !== newItem.filePath && i.url !== newItem.url)];
  saveHistory(updated);
  return newItem;
}

export function removeHistoryItem(id: string): DownloadHistoryItem[] {
  const current = loadHistory();
  const updated = current.filter((item) => item.id !== id);
  saveHistory(updated);
  return updated;
}

export function clearHistory(): void {
  saveHistory([]);
}

export async function checkFileDiskStatus(path: string): Promise<DiskStatus> {
  try {
    return await invoke<DiskStatus>("check_file_status", { path });
  } catch (err) {
    console.error(`Failed to check disk status for ${path}:`, err);
    return { exists: false, is_dir: false };
  }
}

export async function batchCheckDiskStatus(
  items: DownloadHistoryItem[]
): Promise<Record<string, DiskStatus>> {
  const results: Record<string, DiskStatus> = {};
  await Promise.all(
    items.map(async (item) => {
      try {
        const status = await invoke<DiskStatus>("check_file_status", {
          path: item.filePath,
        });
        results[item.id] = status;
      } catch {
        results[item.id] = { exists: false, is_dir: item.isPlaylist };
      }
    })
  );
  return results;
}

export async function revealInFolder(path: string): Promise<void> {
  await invoke("reveal_in_folder", { path });
}

export async function deleteFileFromDisk(path: string): Promise<void> {
  const clean = (path || "").trim().replace(/[/\\]+$/, "");
  const cleanLower = clean.toLowerCase();
  if (
    !clean ||
    clean === "/" ||
    cleanLower.endsWith("/downloads") ||
    cleanLower.endsWith("\\downloads") ||
    cleanLower.endsWith("/desktop") ||
    cleanLower.endsWith("/documents")
  ) {
    throw new Error("Safety refusal: cannot delete system or user directories");
  }
  await invoke("delete_file_from_disk", { path: clean });
}

export async function deleteEmptyDirIfExists(path: string): Promise<boolean> {
  const clean = (path || "").trim().replace(/[/\\]+$/, "");
  const cleanLower = clean.toLowerCase();
  if (
    !clean ||
    clean === "/" ||
    cleanLower.endsWith("/downloads") ||
    cleanLower.endsWith("\\downloads") ||
    cleanLower.endsWith("/desktop") ||
    cleanLower.endsWith("/documents")
  ) {
    return false;
  }
  try {
    return await invoke<boolean>("delete_empty_dir_if_exists", { path: clean });
  } catch {
    return false;
  }
}

