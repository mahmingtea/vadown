import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, User, Film, Music } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import { fetchMetadata } from "./lib/fetch-meta";
import { startDownload } from "./lib/download";
import ProgressCard from "./components/progress";
import PlaylistItem from "./components/playlist-item";
import BrowserHeader from "./components/browser-header";
import DownloadButton from "./components/download-button";
import AnalyzeButton from "./components/analyze-button";
import SelectPlaylist from "./components/select-playlist";
import AppVersion from "./components/app-version";
import DownloadHistory from "./components/download-history";
import { DownloadHistoryItem, checkFileDiskStatus } from "./lib/history";
import { SupportedBrowser, SUPPORTED_BROWSERS } from "./lib/browser-flags";

export default function App() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<"video" | "audio">("video");
  const [isPlaylist, setIsPlaylist] = useState(false);
  const [useBrowserContext, setUseBrowserContext] = useState(false);
  const [selectedBrowser, setSelectedBrowser] = useState<SupportedBrowser>(() => {
    const saved = localStorage.getItem("vadown_browser") as SupportedBrowser | null;
    return (saved && SUPPORTED_BROWSERS.some((b) => b.id === saved)) ? saved : "chrome";
  });
  const [status, setStatus] = useState<"idle" | "analyzing" | "downloading" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [currentLog, setCurrentLog] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [availableFormats, setAvailableFormats] = useState<any[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<string>("best");
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [videoInfo, setVideoInfo] = useState<{ title?: string, thumbnail?: string, uploader?: string, duration?: number } | null>(null);
  const [playlistQuality, setPlaylistQuality] = useState<"highest" | "medium" | "low">("highest");
  const [playlistItems, setPlaylistItems] = useState<{ index: number, title: string, duration?: number }[]>([]);
  const [limitPlaylist, setLimitPlaylist] = useState(true);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);

  const childRef = useRef<any>(null);
  const stdoutBuffer = useRef("");
  const manualStopRef = useRef(false);
  const pidRef = useRef<number | null>(null);
  const activeCleanupRef = useRef<(() => Promise<void>) | null>(null);
  const [bearerToken, setBearerToken] = useState("");
  const [referer, setReferer] = useState("");

  const handleBrowserChange = (browser: SupportedBrowser) => {
    setSelectedBrowser(browser);
    localStorage.setItem("vadown_browser", browser);
  };
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === "downloading" && startTime) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 1000);
    } else if (status !== "downloading") {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [status, startTime]);

  const formatDuration = (ms: number) => {
    if (!ms) return "";
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };


  async function handleFetch() {
    manualStopRef.current = false;
    setPlaylistItems([]);
    setProgress(0);
    setIsAnalyzed(false);
    setVideoInfo(null);
    setAvailableFormats([]);
    await fetchMetadata({
      url,
      isPlaylist,
      setAvailableFormats,
      setStatus,
      setCurrentLog,
      setVideoInfo,
      setPlaylistItems,
      setSelectedItems,
      setIsAnalyzed, setSelectedFormat, childRef, pidRef,
      manualStopRef,
      useBrowserContext, selectedBrowser, bearerToken, referer, limitPlaylist
    })
  }
  async function handleDownload() {
    setProgress(0);
    await startDownload({
      url,
      isPlaylist,
      selectedItems,
      playlistQuality,
      availableFormats,
      selectedFormat,
      setStatus,
      setCurrentLog,
      setPlaylistItems,
      setStartTime,
      setDuration,
      setProgress,
      formatDuration,
      setUrl,
      childRef,
      pidRef,
      manualStopRef,
      activeCleanupRef,
      currentLog, format, stdoutBuffer,
      useBrowserContext, selectedBrowser, bearerToken, referer,
      videoInfo
    })
  }
  const handleStop = async () => {
    manualStopRef.current = true;
    const wasAnalyzing = status === "analyzing";
    try {
      const pidToKill = pidRef.current ?? 0;
      await invoke("kill_process", { pid: pidToKill });
      pidRef.current = null;
      if (childRef.current) {
        await childRef.current.kill();
        childRef.current = null;
      }
    } catch (err) {
      console.error("Failed to stop:", err);
    }

    // Immediately clean up any partial fragments and cover images from the aborted session
    if (activeCleanupRef.current) {
      try {
        await activeCleanupRef.current();
      } catch (err) {
        console.error("Failed to cleanup aborted files:", err);
      }
      activeCleanupRef.current = null;
    }

    setStatus("idle");
    setProgress(0);
    setCurrentLog(wasAnalyzing ? "Analysis stopped." : "Download stopped.");
    setIsAnalyzed(false);
    setPlaylistItems([]);
    setVideoInfo(null);
    setAvailableFormats([]);
  };

  const handleNewDownload = () => {
    setUrl("");
    setAvailableFormats([]);
    setIsAnalyzed(false);
    setIsPlaylist(false);
    setStartTime(null);
    setVideoInfo(null);
    setDuration(null);
    setPlaylistItems([]);
    setSelectedItems([]);
    setProgress(0);
    setStatus("idle");
  };

  const handleRedownload = async (item: DownloadHistoryItem) => {
    if (item.filePath) {
      try {
        const disk = await checkFileDiskStatus(item.filePath);
        if (disk.exists) {
          setCurrentLog("File already exists on disk. Re-download skipped.");
          return;
        }
      } catch {
        // ignore check error
      }
    }

    setProgress(0);
    setUrl(item.url);
    setFormat(item.format);
    setIsPlaylist(item.isPlaylist);
    if (item.isPlaylist) {
      if (item.selectedItems) setSelectedItems(item.selectedItems);
      if (item.playlistQuality) setPlaylistQuality(item.playlistQuality);
    } else {
      if (item.selectedFormat) setSelectedFormat(item.selectedFormat);
    }
    setVideoInfo({
      title: item.title,
      thumbnail: item.thumbnail,
      duration: item.duration,
    });
    await startDownload({
      url: item.url,
      isPlaylist: item.isPlaylist,
      selectedItems: item.selectedItems || [],
      playlistQuality: item.playlistQuality || "highest",
      availableFormats: [],
      selectedFormat: item.selectedFormat || "best",
      setStatus,
      setCurrentLog,
      setPlaylistItems,
      setStartTime,
      setDuration,
      setProgress,
      formatDuration,
      setUrl,
      childRef,
      pidRef,
      manualStopRef,
      activeCleanupRef,
      currentLog: "",
      format: item.format,
      stdoutBuffer,
      useBrowserContext,
      selectedBrowser,
      bearerToken,
      referer,
      videoInfo: {
        title: item.title,
        thumbnail: item.thumbnail,
        duration: item.duration,
      },
      existingHistoryId: item.id,
    });
  };

  const hasPlaylistId = url.includes("list=") || url.includes("/playlist");

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <BrowserHeader
        setIsAnalyzed={setIsAnalyzed}
        useBrowserContext={useBrowserContext}
        setUseBrowserContext={setUseBrowserContext}
        selectedBrowser={selectedBrowser}
        setSelectedBrowser={handleBrowserChange}
        bearerToken={bearerToken}
        setBearerToken={setBearerToken}
        referer={referer}
        setReferer={setReferer}
        status={status}
        setPlaylistItems={setPlaylistItems}
      />
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Media Downloader</h1>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              placeholder="Paste media or playlist link..."
              value={url}
              onChange={(e) => {
                const val = e.target.value;
                setUrl(val);
                setAvailableFormats([]);
                setIsAnalyzed(false);
                setStartTime(null);
                setDuration(null);
                setVideoInfo(null);
                setPlaylistItems([]);
                setSelectedItems([]);
                setProgress(0);
                setStatus("idle");
                setIsPlaylist(false);
              }}
              disabled={status === "downloading" || status === "analyzing"}
              className="flex-1"
            />
            <AnalyzeButton
              status={status}
              handleFetch={handleFetch}
              url={url}
              isAnalyzed={isAnalyzed}
            />
          </div>

          {hasPlaylistId && (
            <SelectPlaylist
              setLimitPlaylist={setLimitPlaylist}
              isPlaylist={isPlaylist}
              setIsPlaylist={setIsPlaylist}
              status={status}
              setAvailableFormats={setAvailableFormats}
              setIsAnalyzed={setIsAnalyzed}
              setVideoInfo={setVideoInfo}
              setPlaylistItems={setPlaylistItems}
            />
          )}
        </div>
      </div>
      {videoInfo && !isPlaylist && status !== "downloading" && status !== "success" && (
        <div className="flex gap-4 p-4 bg-zinc-900/40 rounded-xl border border-zinc-800 shadow-xs">
          {videoInfo.thumbnail ? (
            <img
              src={videoInfo.thumbnail}
              alt="Thumbnail"
              className="w-36 h-22 object-cover rounded-lg bg-zinc-800 shadow-xs shrink-0"
            />
          ) : (
            <div className="w-36 h-22 bg-zinc-800 rounded-lg flex items-center justify-center shrink-0">
              <Loader2 className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex flex-col justify-between overflow-hidden flex-1 min-w-0">
            <div>
              <h3 className="font-semibold text-sm line-clamp-2 leading-tight text-zinc-100" title={videoInfo.title}>
                {videoInfo.title || "Unknown Video"}
              </h3>

              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                {videoInfo.uploader && (
                  <span className="flex items-center gap-1 truncate">
                    <User className="w-3 h-3 shrink-0" />
                    <span className="truncate">{videoInfo.uploader}</span>
                  </span>
                )}
                {videoInfo.duration && (
                  <span className="flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>{formatDuration(videoInfo.duration * 1000)}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2.5 mt-3 pt-2.5 border-t border-zinc-800/80">
              <div className="flex items-center gap-2">
                <div className="inline-flex h-8 p-0.5 rounded-lg bg-zinc-950 border border-zinc-800 items-center">
                  <button
                    type="button"
                    onClick={() => setFormat("video")}
                    className={cn(
                      "h-full flex items-center gap-1.5 px-2.5 text-xs font-medium rounded-md transition-all cursor-pointer select-none",
                      format === "video"
                        ? "bg-zinc-800 text-zinc-100 shadow-xs"
                        : "text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>Video</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat("audio")}
                    className={cn(
                      "h-full flex items-center gap-1.5 px-2.5 text-xs font-medium rounded-md transition-all cursor-pointer select-none",
                      format === "audio"
                        ? "bg-zinc-800 text-zinc-100 shadow-xs"
                        : "text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>Audio</span>
                  </button>
                </div>

                {format === "video" ? (
                  availableFormats.length > 0 ? (
                    <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                      <SelectTrigger className="h-8 px-2.5 text-xs bg-zinc-950 border-zinc-800 hover:border-zinc-700 rounded-lg text-zinc-200 min-w-28">
                        <SelectValue placeholder="Select quality" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200">
                        {availableFormats.map((f) => (
                          <SelectItem key={f.id} value={f.id} className="text-xs cursor-pointer focus:bg-zinc-800 focus:text-zinc-100">
                            {f.height}p ({f.ext}) {f.note}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center h-8 px-2.5 text-xs text-zinc-300 font-mono bg-zinc-950 border border-zinc-800 rounded-lg">
                      Best quality
                    </div>
                  )
                ) : (
                  <div className="flex items-center h-8 px-2.5 text-xs text-zinc-300 font-mono bg-zinc-950 border border-zinc-800 rounded-lg">
                    MP3 • 320 kbps
                  </div>
                )}
              </div>

              <DownloadButton isPlaylist={isPlaylist} selectedItems={selectedItems} status={status} handleDownload={handleDownload} url={url} />
            </div>
          </div>
        </div>
      )}
      {isPlaylist && playlistItems.length > 0 && status !== "downloading" && status !== "success" && (
        <div className="flex flex-col gap-3 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-zinc-100">{videoInfo?.title || "Playlist"}</span>
              <span className="text-xs text-muted-foreground">{selectedItems.length} of {playlistItems.length} selected</span>
            </div>

            <div className="inline-flex h-8 p-0.5 rounded-lg bg-zinc-950 border border-zinc-800 items-center shrink-0">
              <button
                type="button"
                onClick={() => setFormat("video")}
                className={cn(
                  "h-full flex items-center gap-1.5 px-2.5 text-xs font-medium rounded-md transition-all cursor-pointer select-none",
                  format === "video"
                    ? "bg-zinc-800 text-zinc-100 shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Video</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat("audio")}
                className={cn(
                  "h-full flex items-center gap-1.5 px-2.5 text-xs font-medium rounded-md transition-all cursor-pointer select-none",
                  format === "audio"
                    ? "bg-zinc-800 text-zinc-100 shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                <Music className="w-3.5 h-3.5" />
                <span>Audio</span>
              </button>
            </div>
          </div>

          {format === "video" ? (
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-xs text-zinc-400">Quality:</span>
              <div className="flex gap-1.5 flex-1">
                {(["highest", "medium", "low"] as const).map((q) => (
                  <Button
                    key={q}
                    variant={playlistQuality === q ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-8 text-xs flex-1 capitalize rounded-lg",
                      playlistQuality === q
                        ? "bg-zinc-100 text-zinc-900 font-medium"
                        : "bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                    )}
                    onClick={() => setPlaylistQuality(q)}
                  >
                    {q === "medium" ? "720p (Medium)" : q === "highest" ? "Highest" : "Low"}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between h-8 px-2.5 bg-zinc-950/60 border border-zinc-800/80 rounded-lg">
              <span className="text-xs text-zinc-300 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-blue-400" />
                <span>Playlist audio extraction</span>
              </span>
              <span className="text-[11px] font-mono text-zinc-500">All tracks • MP3 (320 kbps)</span>
            </div>
          )}

          <div className="border-t border-zinc-800/80 pt-2 flex justify-between items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs bg-zinc-950 border-zinc-800 hover:bg-zinc-800 text-zinc-300"
              onClick={() => {
                if (selectedItems.length === playlistItems.length) setSelectedItems([]);
                else setSelectedItems(playlistItems.map(i => i.index));
              }}
            >
              {selectedItems.length === playlistItems.length ? "Deselect all" : "Select all"}
            </Button>
            <DownloadButton isPlaylist={isPlaylist} selectedItems={selectedItems} status={status} handleDownload={handleDownload} url={url} />
          </div>

          <div className="max-h-64 overflow-y-auto flex flex-col gap-1 pr-1.5 mt-1">
            {playlistItems.map(item => (
              <PlaylistItem key={item.index} item={item} selectedItems={selectedItems} setSelectedItems={setSelectedItems} formatDuration={formatDuration} />
            ))}
          </div>
        </div>
      )}
      {status !== "idle" && (
        <ProgressCard status={status} currentLog={currentLog} duration={duration} elapsedTime={elapsedTime} progress={progress} isPlaylist={isPlaylist} handleStop={handleStop} handleNewDownload={handleNewDownload} formatDuration={formatDuration} />
      )}
      <DownloadHistory onRedownload={handleRedownload} />
      <AppVersion />
    </div>
  );
}