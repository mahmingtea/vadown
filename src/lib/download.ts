import { downloadDir, executableDir } from "@tauri-apps/api/path";
import { Command } from "@tauri-apps/plugin-shell";
import { readDir, remove } from "@tauri-apps/plugin-fs";
import { getBrowserFlags, needsYouTubeCookies, isYouTube } from "./browser-flags";

type Props = {
    url: string;
    isPlaylist: boolean;
    selectedItems: number[];
    playlistQuality: "highest" | "medium" | "low";
    availableFormats: any[];
    selectedFormat: string;
    useBrowserContext: boolean;
    bearerToken: string;
    referer: string;
    setStatus: (status: "idle" | "analyzing" | "downloading" | "success" | "error") => void;
    setCurrentLog: (log: string) => void;
    setPlaylistItems: (items: { index: number, title: string, duration?: number }[]) => void;
    setStartTime: (time: number | null) => void;
    setDuration: (duration: string | null) => void;
    setProgress: React.Dispatch<React.SetStateAction<number>>;
    formatDuration: (ms: number) => string;
    setUrl: (url: string) => void;
    format: "video" | "audio";
    stdoutBuffer: React.RefObject<string>;
    pidRef: React.RefObject<number | null>;
    manualStopRef: React.RefObject<boolean>;
    childRef: React.RefObject<any>;
    currentLog: string;
}
async function resolveFfmpegDir(): Promise<string> {
    try {
        const { invoke } = await import("@tauri-apps/api/core");
        const dir = await invoke<string>("get_exe_dir");
        if (dir) return dir;
    } catch (error) {
        console.warn("Custom Rust command get_exe_dir failed, using fallback...");
    }
    try {
        const fallbackDir = await executableDir();
        return fallbackDir;
    } catch (error) {
        console.error("Could not resolve executable directory:", error);
        return "";
    }
}
const KEEP_EXTENSIONS = new Set(["mp4", "mp3", "mkv", "webm", "m4a", "opus", "flac", "wav"]);

async function cleanLeftoverFiles(folder: string): Promise<void> {
    try {
        const entries = await readDir(folder);
        const keepFiles = new Set(
            entries
                .filter(e => e.name && KEEP_EXTENSIONS.has(e.name.split(".").pop()?.toLowerCase() ?? ""))
                .map(e => e.name!.substring(0, e.name!.lastIndexOf(".")))
        );

        for (const entry of entries) {
            if (!entry.name) continue;
            const dotIndex = entry.name.lastIndexOf(".");
            if (dotIndex === -1) continue;
            const ext = entry.name.substring(dotIndex + 1).toLowerCase();
            const base = entry.name.substring(0, dotIndex);
            if (["jpg", "jpeg", "webp", "png"].includes(ext) && keepFiles.has(base)) {
                try {
                    await remove(`${folder}/${entry.name}`);
                } catch {
                }
            }
        }
    } catch {
    }
}

export const startDownload = async ({
    url, isPlaylist, selectedItems, playlistQuality,
    availableFormats, selectedFormat,
    useBrowserContext, bearerToken, referer,
    setStatus, setCurrentLog, setPlaylistItems, childRef, pidRef,
    manualStopRef, setStartTime, setDuration, setProgress,
    formatDuration, format, stdoutBuffer, currentLog,
    setUrl
}: Props) => {
    if (!url) return;
    if (isPlaylist && selectedItems.length === 0) {
        setCurrentLog("Please select at least one video to download.");
        setStatus("error");
        return;
    }

    const downloadFolder = await downloadDir();

    setCurrentLog("Preparing download...");
    const ffmpegDir = await resolveFfmpegDir();
    const ffmpegArgs = ffmpegDir ? ["--ffmpeg-location", ffmpegDir] : [];

    const browserFlags = getBrowserFlags(url, useBrowserContext, bearerToken, referer, false);

    const playlistItemsArg = selectedItems.length > 0
        ? selectedItems.sort((a, b) => a - b).join(",")
        : "1";

    const playlistFlags = isPlaylist
        ? ["--yes-playlist", "--playlist-items", playlistItemsArg]
        : ["--no-playlist", "--playlist-items", "1"];

    const playlistPrefix = isPlaylist ? "%(playlist_index)02d - " : "";

    let args: string[] = [];

    if (format === "video") {
        const heightTag = availableFormats.length > 0 && !isPlaylist ? " [%(height)sp]" : "";
        const outputPath = `${downloadFolder}/${playlistPrefix}%(title|Unknown_Stream)s${heightTag}.%(ext)s`;

        let formatSelector: string;
        if (isPlaylist) {
            if (playlistQuality === "highest") {
                formatSelector = "bestvideo+bestaudio/best";
            } else if (playlistQuality === "medium") {
                formatSelector = "bestvideo[height<=720]+bestaudio/best[height<=720]";
            } else {
                formatSelector = "worstvideo+worstaudio/worst";
            }
        } else {
            if (availableFormats.length > 0) {
                formatSelector = `${selectedFormat}+bestaudio[ext=m4a]/best`;
            } else {
                formatSelector = "best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best";
            }
        }

        args = [
            "--newline",
            "--no-colors",
            "--no-part",
            "--no-keep-video",
            "--concurrent-fragments", "1",
            ...playlistFlags,
            "--force-overwrites",
            "--hls-prefer-native",

            ...ffmpegArgs,

            "-f", formatSelector,
            "--merge-output-format", "mp4",
            "--remux-video", "mp4",

            "--convert-thumbnails", "jpg",
            "--embed-thumbnail",

            "--embed-metadata",

            "-o", outputPath,
            ...browserFlags,
            "--",
            url.trim()
        ];
    } else {
        const outputPath = `${downloadFolder}/${playlistPrefix}%(title|Unknown_Stream)s.%(ext)s`;

        args = [
            "--newline",
            "--no-colors",
            "--no-part",
            "--concurrent-fragments", "1",
            ...playlistFlags,
            "--force-overwrites",

            ...ffmpegArgs,

            "-f", "bestaudio/best",
            "--extract-audio",
            "--audio-format", "mp3",
            "--audio-quality", "0",

            "--convert-thumbnails", "jpg",
            "--embed-thumbnail",
            "--embed-metadata",

            "-o", outputPath,
            ...browserFlags,
            "--",
            url.trim()
        ];
    }

    setStatus("downloading");
    setProgress(0);
    setDuration(null);
    manualStopRef.current = false;
    setStartTime(Date.now());
    const startTime = Date.now();
    setCurrentLog(
        isPlaylist
            ? `Starting download of ${selectedItems.length} videos...`
            : `Initializing ${format} download...`
    );
    stdoutBuffer.current = "";

    try {
        const command = Command.sidecar("bin/yt-dlp", args);
        let stderrBuffer = "";

        command.stdout.on("data", (data: string) => {
            stdoutBuffer.current += data;
            const lines = stdoutBuffer.current.split("\n");
            stdoutBuffer.current = lines.pop() || "";

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;

                const playlistMatch = trimmedLine.match(/Downloading (?:video|item) (\d+) of (\d+)/);
                if (playlistMatch) {
                    setCurrentLog(`Downloading video ${playlistMatch[1]} of ${playlistMatch[2]}...`);
                    setProgress(0);
                } else if (trimmedLine.includes("[download]") && trimmedLine.includes("%")) {
                    const pMatch = trimmedLine.match(/([\d.]+)%/);
                    if (pMatch) {
                        const p = parseFloat(pMatch[1]);
                        if (!isNaN(p)) setProgress((prev) => Math.max(prev, Math.min(p, 100)));
                    }
                } else if (
                    trimmedLine.includes("Merging formats") ||
                    trimmedLine.includes("Remuxing video") ||
                    trimmedLine.includes("Converting thumbnail") ||
                    trimmedLine.includes("Adding thumbnail") ||
                    trimmedLine.includes("Post-process") ||
                    trimmedLine.includes("Deleting original file")
                ) {
                    setProgress(100);
                    if (trimmedLine.includes("thumbnail")) {
                        setCurrentLog("Embedding thumbnail...");
                    } else if (trimmedLine.includes("Merging") || trimmedLine.includes("Remuxing")) {
                        setCurrentLog("Merging video & audio...");
                    }
                } else if (
                    !trimmedLine.startsWith("[download]") &&
                    !trimmedLine.startsWith("[ExtractAudio]") &&
                    !currentLog.includes("Downloading video")
                ) {
                    setCurrentLog(trimmedLine);
                }
            }
        });

        command.stderr.on("data", (data: string) => {
            stderrBuffer += data;
            const trimmed = data.trim();
            if (!trimmed) return;
            if (
                trimmed.toLowerCase().includes("error") &&
                !trimmed.includes("deprecated")
            ) {
                console.error("[yt-dlp stderr]", trimmed);
                setCurrentLog(trimmed.slice(0, 150));
            }
        });

        command.on("close", async (data) => {
            if (manualStopRef.current) return;

            if (data.code === 0) {
                await cleanLeftoverFiles(downloadFolder);
                setStatus("success");
                setUrl("");
                const endTime = Date.now();
                if (startTime) setDuration(formatDuration(endTime - startTime));
                setProgress(100);
                setPlaylistItems([]);
                setCurrentLog(
                    isPlaylist ? "Playlist download complete!" : "Download finished successfully!"
                );
                return;
            }

            if (isYouTube(url) && useBrowserContext && needsYouTubeCookies(stderrBuffer)) {
                setCurrentLog("Retrying with browser cookies (close Chrome if open)...");
                setProgress(0);
                stderrBuffer = "";
                stdoutBuffer.current = "";

                const retryBrowserFlags = getBrowserFlags(url, useBrowserContext, bearerToken, referer, true);
                const retryArgs = args
                    .slice(0, args.indexOf("--"))
                    .filter((a) => a !== "--cookies-from-browser" && a !== "chrome")
                    .concat(retryBrowserFlags, ["--", url.trim()]);

                const retryCommand = Command.sidecar("bin/yt-dlp", retryArgs);

                retryCommand.stdout.on("data", (d: string) => {
                    stdoutBuffer.current += d;
                    const lines = stdoutBuffer.current.split("\n");
                    stdoutBuffer.current = lines.pop() || "";
                    for (const line of lines) {
                        const t = line.trim();
                        if (!t) continue;
                        if (t.includes("[download]") && t.includes("%")) {
                            const m = t.match(/([\d.]+)%/);
                            if (m) {
                                const p = parseFloat(m[1]);
                                if (!isNaN(p)) setProgress((prev) => Math.max(prev, Math.min(p, 100)));
                            }
                        } else if (!t.startsWith("[download]") && !t.startsWith("[ExtractAudio]")) {
                            setCurrentLog(t);
                        }
                    }
                });

                retryCommand.stderr.on("data", (d: string) => { stderrBuffer += d; });

                retryCommand.on("close", async (retryData) => {
                    if (manualStopRef.current) return;
                    if (retryData.code === 0) {
                        await cleanLeftoverFiles(downloadFolder);
                        setStatus("success");
                        setUrl("");
                        const endTime = Date.now();
                        if (startTime) setDuration(formatDuration(endTime - startTime));
                        setProgress(100);
                        setPlaylistItems([]);
                        setCurrentLog("Download finished successfully!");
                    } else {
                        const e = stderrBuffer.toLowerCase();
                        if (e.includes("database is locked") || e.includes("unable to open")) {
                            setCurrentLog("Cookie error: close Chrome completely and try again.");
                        } else {
                            setCurrentLog(`Download failed (exit code ${retryData.code}).`);
                        }
                        setStatus("error");
                    }
                });

                const retryChild = await retryCommand.spawn();
                childRef.current = retryChild;
                pidRef.current = retryChild.pid;
                return;
            }

            setStatus("error");
            setCurrentLog(
                `Exit code ${data.code} — ffmpeg dir: "${ffmpegDir || "not resolved"}". ` +
                `Ensure ffmpeg & ffprobe are in src-tauri/bin/ and listed in tauri.conf.json externalBin.`
            );
        });

        const child = await command.spawn();
        childRef.current = child;
        pidRef.current = child.pid;
    } catch (err) {
        console.error(err);
        setStatus("error");
        setCurrentLog(`Spawn error: ${String(err)}`);
    }
};