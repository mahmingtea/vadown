import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Clock, User, LaptopMinimalCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { invoke } from "@tauri-apps/api/core";
import { fetchMetadata } from "./lib/fetch-meta";
import { startDownload } from "./lib/download";
import ProgressCard from "./components/progress";
import PlaylistItem from "./components/playlist-item";
import BrowserHeader from "./components/browser-header";
import DownloadButton from "./components/download-button";
import AnalyzeButton from "./components/analyze-button";
import SelectPlaylist from "./components/select-playlist";
import AppVersion from "./components/app-version";

export default function App() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<"video" | "audio">("video");
  const [isPlaylist, setIsPlaylist] = useState(false);
  const [useBrowserContext, setUseBrowserContext] = useState(false);
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
  const [bearerToken, setBearerToken] = useState("");
  const [referer, setReferer] = useState("");
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
    setPlaylistItems([]);
    await fetchMetadata({
      url,
      isPlaylist,
      setAvailableFormats,
      setStatus,
      setCurrentLog,
      setVideoInfo,
      setPlaylistItems,
      setSelectedItems,
      setIsAnalyzed, setSelectedFormat, childRef,
      useBrowserContext, bearerToken, referer, limitPlaylist
    })
  }
  async function handleDownload() {
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
      currentLog, format, stdoutBuffer,
      useBrowserContext, bearerToken, referer
    })
  }
  const handleStop = async () => {
    manualStopRef.current = true;
    try {
      if (pidRef.current) {
        await invoke("kill_process", { pid: pidRef.current });
        pidRef.current = null;
      }
      if (childRef.current) {
        await childRef.current.kill();
        childRef.current = null;
      }
    } catch (err) {
      console.error("Failed to stop:", err);
    }

    setStatus("idle");
    setProgress(0);
    setCurrentLog("Download stopped.");
    setIsAnalyzed(false);
    setPlaylistItems([]);
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
    setStatus("idle");
  };

  const hasPlaylistId = url.includes("list=") || url.includes("/playlist");
  const needsAnalysis = !isAnalyzed && (isPlaylist || format === "video");

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <BrowserHeader setIsAnalyzed={setIsAnalyzed} useBrowserContext={useBrowserContext} setUseBrowserContext={setUseBrowserContext} bearerToken={bearerToken} setBearerToken={setBearerToken} referer={referer} setReferer={setReferer} status={status} setPlaylistItems={setPlaylistItems} />
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Media Downloader</h1>
        <div className="flex flex-col gap-4">
          <Tabs defaultValue="video" onValueChange={(v) => {
            setFormat(v as "video" | "audio");
          }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="video" disabled={status === "downloading" || status === "analyzing"}>Video (MP4)</TabsTrigger>
              <TabsTrigger value="audio" disabled={status === "downloading" || status === "analyzing"}>Audio (MP3)</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                placeholder="Paste link here..."
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
                  setStatus("idle");
                  setIsPlaylist(false)
                }}
                disabled={status === "downloading" || status === "analyzing"}
                className="flex-1"
              />
              {needsAnalysis ? (
                <AnalyzeButton status={status} handleFetch={handleFetch} url={url} />
              ) : (
                <>{isAnalyzed && format === "video" ? <Button disabled className="w-40"><LaptopMinimalCheck className="w-4 h-4" />Analyzed</Button> : <DownloadButton isPlaylist={isPlaylist} selectedItems={selectedItems} status={status} handleDownload={handleDownload} url={url} />}</>
              )}
            </div>

            {hasPlaylistId && (
              <SelectPlaylist setLimitPlaylist={setLimitPlaylist} isPlaylist={isPlaylist} setIsPlaylist={setIsPlaylist} status={status} setAvailableFormats={setAvailableFormats} setIsAnalyzed={setIsAnalyzed} setVideoInfo={setVideoInfo} setPlaylistItems={setPlaylistItems} />
            )}
          </div>
        </div>
      </div>
      {videoInfo && !isPlaylist && status !== "downloading" && status !== "success" && (
        <div className="flex gap-4 p-4 bg-zinc-900/40 rounded-xl border border-zinc-800 shadow-sm">
          {videoInfo.thumbnail ? (
            <img
              src={videoInfo.thumbnail}
              alt="Thumbnail"
              className="w-32 h-20 object-cover rounded-md bg-zinc-800 shadow-sm"
            />
          ) : (
            <div className="w-32 h-20 bg-zinc-800 rounded-md flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex flex-col justify-center overflow-hidden flex-1">
            <h3 className="font-semibold text-sm line-clamp-2 leading-tight" title={videoInfo.title}>
              {videoInfo.title || "Unknown Video"}
            </h3>

            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
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
            <div className="flex gap-2 items-center mt-2">
              {availableFormats.length > 0 && format === "video" && (
                <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                  <SelectTrigger className=" h-7 text-xs">
                    <SelectValue placeholder="Select Quality" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFormats.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.height}p ({f.ext}) {f.note}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <DownloadButton isPlaylist={isPlaylist} selectedItems={selectedItems} status={status} handleDownload={handleDownload} url={url} />
            </div>
          </div>
        </div>
      )}
      {isPlaylist && playlistItems.length > 0 && status !== "downloading" && status !== "success" && (
        <div className="flex flex-col gap-2 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 shadow-sm">
          {format === "video" && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Playlist Download Quality
              </label>
              <div className="flex gap-2">
                {(["highest", "medium", "low"] as const).map((q) => (
                  <Button
                    key={q}
                    variant={playlistQuality === q ? "default" : "outline"}
                    size="sm"
                    className="flex-1 capitalize"
                    onClick={() => setPlaylistQuality(q)}
                  >
                    {q === "medium" ? "720p (Med)" : q}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {format === "video" && <hr className="border-zinc-800" />}
          <div className="flex justify-between items-center mb-2 gap-2">
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{videoInfo?.title || "Playlist Videos"}</span>
              <span className="text-xs text-muted-foreground">{selectedItems.length} of {playlistItems.length} selected</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                if (selectedItems.length === playlistItems.length) setSelectedItems([]);
                else setSelectedItems(playlistItems.map(i => i.index));
              }}
            >
              {selectedItems.length === playlistItems.length ? "Deselect All" : "Select All"}
            </Button>
            <DownloadButton isPlaylist={isPlaylist} selectedItems={selectedItems} status={status} handleDownload={handleDownload} url={url} />
          </div>
          <div className="max-h-64 overflow-y-auto flex flex-col gap-1 pr-2">
            {playlistItems.map(item => (
              <PlaylistItem key={item.index} item={item} selectedItems={selectedItems} setSelectedItems={setSelectedItems} formatDuration={formatDuration} />
            ))}
          </div>
        </div>
      )}
      {status !== "idle" && (
        <ProgressCard status={status} currentLog={currentLog} duration={duration} elapsedTime={elapsedTime} progress={progress} isPlaylist={isPlaylist} handleStop={handleStop} handleNewDownload={handleNewDownload} formatDuration={formatDuration} />
      )}
      <AppVersion />
    </div>
  );
}