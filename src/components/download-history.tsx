import { useState, useEffect, useMemo, useCallback } from "react";
import {
  DownloadHistoryItem,
  DiskStatus,
  loadHistory,
  removeHistoryItem,
  clearHistory,
  batchCheckDiskStatus,
  revealInFolder,
  deleteFileFromDisk,
} from "@/lib/history";
import { openPath } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Play,
  FolderOpen,
  RotateCcw,
  Trash2,
  Search,
  X,
  Music,
  Video,
  Layers,
  AlertTriangle,
  FolderSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DownloadHistoryProps {
  onRedownload: (item: DownloadHistoryItem) => void;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDurationSec(seconds?: number): string {
  if (!seconds || seconds <= 0) return "";
  const sec = Math.floor(seconds % 60);
  const min = Math.floor((seconds / 60) % 60);
  const hr = Math.floor(seconds / 3600);
  if (hr > 0) return `${hr}:${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export default function DownloadHistory({ onRedownload }: DownloadHistoryProps) {
  const [items, setItems] = useState<DownloadHistoryItem[]>([]);
  const [diskStatuses, setDiskStatuses] = useState<Record<string, DiskStatus>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "video" | "audio" | "playlist">("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshDiskStatus = useCallback(async (currentItems: DownloadHistoryItem[]) => {
    if (currentItems.length === 0) {
      setDiskStatuses({});
      return;
    }
    const statuses = await batchCheckDiskStatus(currentItems);
    setDiskStatuses(statuses);
  }, []);

  const reloadData = useCallback(() => {
    const loaded = loadHistory();
    setItems(loaded);
    refreshDiskStatus(loaded);
  }, [refreshDiskStatus]);

  useEffect(() => {
    reloadData();

    const handleHistoryUpdated = () => {
      reloadData();
    };

    const handleFocus = () => {
      // Re-verify disk status whenever user returns to VADown
      const current = loadHistory();
      refreshDiskStatus(current);
    };

    window.addEventListener("vadown:history-updated", handleHistoryUpdated);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("vadown:history-updated", handleHistoryUpdated);
      window.removeEventListener("focus", handleFocus);
    };
  }, [reloadData, refreshDiskStatus]);

  useEffect(() => {
    if (!isClearAllDialogOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsClearAllDialogOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isClearAllDialogOpen]);

  const handleOpenFile = async (item: DownloadHistoryItem) => {
    setActionError(null);
    try {
      if (item.isPlaylist) {
        await invoke("open_download_folder", { path: item.filePath });
      } else {
        await openPath(item.filePath);
      }
    } catch (err) {
      console.error("Failed to open path:", err);
      setActionError(`Could not open: ${String(err)}`);
    }
  };

  const handleRevealInFinder = async (item: DownloadHistoryItem) => {
    setActionError(null);
    try {
      await revealInFolder(item.filePath);
    } catch (err) {
      console.error("Failed to reveal in Finder:", err);
      setActionError(`Could not reveal: ${String(err)}`);
    }
  };

  const handleDeleteFromDisk = async (item: DownloadHistoryItem) => {
    setActionError(null);
    const cleanPath = (item.filePath || "").trim().replace(/[/\\]+$/, "");
    const cleanLower = cleanPath.toLowerCase();
    if (
      !cleanPath ||
      cleanPath === "/" ||
      cleanLower.endsWith("/downloads") ||
      cleanLower.endsWith("\\downloads") ||
      cleanLower.endsWith("/desktop") ||
      cleanLower.endsWith("/documents") ||
      item.fileName === "Downloads"
    ) {
      handleRemoveFromHistory(item);
      return;
    }
    try {
      await deleteFileFromDisk(cleanPath);
      // Remove from history list so the deleted download is gone from the list too
      handleRemoveFromHistory(item);
    } catch (err) {
      console.error("Failed to delete file from disk:", err);
      if (String(err).includes("safety refusal") || String(err).includes("cannot delete")) {
        handleRemoveFromHistory(item);
      } else {
        setActionError(`Delete failed: ${String(err)}`);
      }
    }
  };

  const handleRemoveFromHistory = (item: DownloadHistoryItem) => {
    const updated = removeHistoryItem(item.id);
    setItems(updated);
    setDeleteConfirmId(null);
  };

  const handleClearAll = () => {
    if (items.length === 0) return;
    clearHistory();
    setItems([]);
    setDiskStatuses({});
    setDeleteConfirmId(null);
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterType === "video" && (item.format !== "video" || item.isPlaylist)) return false;
      if (filterType === "audio" && (item.format !== "audio" || item.isPlaylist)) return false;
      if (filterType === "playlist" && !item.isPlaylist) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.fileName.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q)
      );
    });
  }, [items, filterType, searchQuery]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 pt-4 border-t border-zinc-800/80">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
            Downloads
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-medium">
              {items.length}
            </span>
          </h2>

          {/* Quick Filter Pills */}
          {items.length > 2 && (
            <div className="flex items-center gap-1 ml-2">
              {(["all", "video", "audio", "playlist"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-md capitalize transition-colors cursor-pointer",
                    filterType === type
                      ? "bg-zinc-800 text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {items.length > 3 && (
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter downloads..."
                className="h-7 pl-8 pr-7 text-xs bg-zinc-900/60 border-zinc-800"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsClearAllDialogOpen(true)}
            className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
          >
            Clear all
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 px-3 py-1.5 rounded-md flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Scrollable list shelf */}
      <div className="max-h-72 overflow-y-auto pr-1 flex flex-col gap-2 rounded-lg scrollbar-thin">
        {filteredItems.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground bg-zinc-900/20 rounded-lg border border-dashed border-zinc-800">
            No matching downloads found.
          </div>
        ) : (
          filteredItems.map((item) => {
            const status = diskStatuses[item.id] ?? { exists: true, is_dir: item.isPlaylist };
            const isMissing = !status.exists;
            const isConfirmingDelete = deleteConfirmId === item.id;
            const displaySize = status.size ? formatBytes(status.size) : formatBytes(item.fileSize);

            return (
              <div
                key={item.id}
                className={cn(
                  "group relative flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all duration-150",
                  isMissing
                    ? "bg-zinc-950/40 border-zinc-900/80 opacity-80"
                    : "bg-zinc-900/40 hover:bg-zinc-900/70 border-zinc-800/80 shadow-xs"
                )}
              >
                {/* Left: Thumbnail / Icon */}
                <div className="relative w-16 h-12 rounded-md overflow-hidden bg-zinc-800 shrink-0 flex items-center justify-center">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className={cn(
                        "w-full h-full object-cover",
                        isMissing && "grayscale brightness-75"
                      )}
                    />
                  ) : item.isPlaylist ? (
                    <Layers className="w-5 h-5 text-blue-400" />
                  ) : item.format === "audio" ? (
                    <Music className="w-5 h-5 text-zinc-400" />
                  ) : (
                    <Video className="w-5 h-5 text-zinc-400" />
                  )}

                  {/* Duration or item count badge */}
                  {item.isPlaylist ? (
                    <span className="absolute bottom-1 right-1 text-[9px] font-mono px-1 py-0.2 rounded bg-black/80 text-blue-300 font-semibold flex items-center gap-0.5">
                      {item.itemCount || 1} items
                    </span>
                  ) : item.duration ? (
                    <span className="absolute bottom-1 right-1 text-[9px] font-mono px-1 py-0.2 rounded bg-black/80 text-zinc-200">
                      {formatDurationSec(item.duration)}
                    </span>
                  ) : null}
                </div>

                {/* Middle: Details */}
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3
                      className={cn(
                        "text-xs font-medium truncate leading-snug",
                        isMissing ? "text-zinc-400 line-through" : "text-foreground"
                      )}
                      title={item.title}
                    >
                      {item.title}
                    </h3>
                  </div>

                  {/* Metadata Row */}
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground font-mono">
                    {/* Format / Type Pill */}
                    {item.isPlaylist ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase font-sans font-semibold">
                        Playlist
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-zinc-800 text-zinc-300 uppercase font-sans">
                        {item.format === "video" ? item.quality || "MP4" : "MP3"}
                      </span>
                    )}

                    {displaySize && <span>{displaySize}</span>}
                    <span>•</span>
                    <span>{formatTimeAgo(item.timestamp)}</span>

                    {/* Status Pill */}
                    <div className="flex items-center gap-1 ml-auto">
                      {isMissing ? (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400/90 font-sans">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Deleted from disk
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400/90 font-sans">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Ready
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-md border border-zinc-800 animate-in fade-in-50">
                      {!isMissing ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteFromDisk(item)}
                          className="h-6 text-[11px] px-2 py-0 cursor-pointer"
                          title="Delete file from your computer and remove from list"
                        >
                          Delete
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveFromHistory(item)}
                          className="h-6 text-[11px] px-2 py-0 cursor-pointer"
                          title="Remove missing entry from list"
                        >
                          Remove
                        </Button>
                      )}
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Open / Play or Redownload */}
                      {isMissing ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRedownload(item)}
                          className="h-7 text-xs px-2.5 gap-1.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Redownload</span>
                        </Button>
                      ) : item.isPlaylist ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenFile(item)}
                          className="h-7 text-xs px-2.5 gap-1.5 hover:bg-zinc-800 cursor-pointer"
                          title="Open playlist folder"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                          <span>Folder</span>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenFile(item)}
                          className="h-7 text-xs px-2.5 gap-1.5 hover:bg-zinc-800 cursor-pointer"
                          title="Play media"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Open</span>
                        </Button>
                      )}

                      {/* Reveal in Finder (if exists) */}
                      {!isMissing && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRevealInFinder(item)}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Show in Finder"
                        >
                          <FolderSearch className="w-3.5 h-3.5" />
                        </Button>
                      )}


                      {/* Delete Trigger */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmId(item.id)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                        title="Delete options"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Dialog for Clear All */}
      {isClearAllDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setIsClearAllDialogOpen(false)}
        >
          <div
            className="relative w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 shrink-0 mt-0.5">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">
                  Clear Download History?
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to remove all <span className="font-mono text-zinc-200">{items.length}</span> items from your download history? Downloaded files on your disk will not be deleted.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-900">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsClearAllDialogOpen(false)}
                className="h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  handleClearAll();
                  setIsClearAllDialogOpen(false);
                }}
                className="h-8 text-xs cursor-pointer"
              >
                Clear All History
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
