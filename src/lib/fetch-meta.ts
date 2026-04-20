import { Command } from "@tauri-apps/plugin-shell";
import { getBrowserFlags, needsYouTubeCookies, isYouTube } from "./browser-flags";

type Props = {
    url: string;
    isPlaylist: boolean;
    useBrowserContext: boolean;
    bearerToken: string;
    referer: string;
    setStatus: (status: "idle" | "analyzing" | "downloading" | "success" | "error") => void;
    setCurrentLog: (log: string) => void;
    setAvailableFormats: (formats: any[]) => void;
    setSelectedFormat: (format: string) => void;
    setIsAnalyzed: (analyzed: boolean) => void;
    setVideoInfo: (info: { title?: string, thumbnail?: string, uploader?: string, duration?: number }) => void;
    setPlaylistItems: (items: { index: number, title: string, duration?: number }[]) => void;
    setSelectedItems: (items: number[]) => void;
    childRef: React.RefObject<any>;
    limitPlaylist: boolean;
}
function runYtDlpDumpJson(
    url: string,
    isPlaylist: boolean,
    extraFlags: string[],
    childRef: React.RefObject<any>,
    limitPlaylist: boolean,
): Promise<{ jsonStr: string; errorStr: string }> {
    return new Promise((resolve) => {
        const playlistEnd = limitPlaylist ? ["--playlist-end", "50"] : [];
        const args = isPlaylist
            ? ["--dump-json", "--flat-playlist", ...playlistEnd, ...extraFlags, url.trim()]
            : ["--dump-json", "--no-playlist", "--playlist-items", "1", ...extraFlags, url.trim()];

        const command = Command.sidecar("bin/yt-dlp", args);
        let jsonStr = "";
        let errorStr = "";

        command.stdout.on("data", (d: string) => { jsonStr += d; });
        command.stderr.on("data", (d: string) => { errorStr += d; });
        command.on("close", () => resolve({ jsonStr, errorStr }));
        command.on("error", () => resolve({ jsonStr, errorStr }));
        command.spawn().then((child) => { childRef.current = child; }).catch(() => resolve({ jsonStr, errorStr }));
    });
}
function parseAndApply(
    jsonStr: string,
    isPlaylist: boolean,
    limitPlaylist: boolean,
    props: Props,
): { success: boolean; message: string } {
    const {
        setAvailableFormats, setSelectedFormat, setIsAnalyzed,
        setVideoInfo, setPlaylistItems, setSelectedItems,
    } = props;

    const lines = jsonStr.trim().split("\n").filter(Boolean);
    if (lines.length === 0) return { success: false, message: "" };

    if (isPlaylist) {
        let entries = lines.map((l) => JSON.parse(l));
        const totalFound = entries.length;
        if (limitPlaylist && entries.length > 50) entries = entries.slice(0, 50);

        const items = entries.map((e: any, i: number) => ({
            index: i + 1,
            title: e.title || "Unknown Title",
            duration: e.duration,
        }));

        setPlaylistItems(items);
        setSelectedItems(items.map((i: any) => i.index));
        setVideoInfo({
            title: entries[0].playlist_title || "Playlist",
            uploader: entries[0].uploader || entries[0].channel,
        });
        setIsAnalyzed(true);

        const msg = limitPlaylist && totalFound > 50
            ? `Found ${totalFound} videos. Limited to the first 50.`
            : `Found ${items.length} videos.`;
        return { success: true, message: msg };
    } else {
        const metadata = JSON.parse(lines[0]);
        const hasVideo = metadata.formats?.some(
            (f: any) => f.vcodec && f.vcodec !== "none"
        );
        const hasAudio = metadata.formats?.some(
            (f: any) => f.acodec && f.acodec !== "none"
        );
        if (!hasVideo && !hasAudio) {
            return { success: false, message: "This URL does not contain downloadable media." };
        }
        setVideoInfo({
            title: metadata.title,
            thumbnail: metadata.thumbnail,
            uploader: metadata.uploader,
            duration: metadata.duration,
        });

        if (metadata.formats) {
            const formats = metadata.formats
                .filter((f: any) => f.vcodec && f.vcodec !== "none" && f.height)
                .map((f: any) => ({
                    id: f.format_id, height: f.height, ext: f.ext, note: f.format_note || "",
                }))
                .filter((v: any, i: number, a: any[]) =>
                    a.findIndex((t: any) => t.height === v.height) === i)
                .sort((a: any, b: any) => b.height - a.height);

            setAvailableFormats(formats);
            if (formats.length > 0) setSelectedFormat(formats[0].id);
            setIsAnalyzed(true);
            return { success: true, message: `Found ${formats.length} quality options.` };
        }

        throw new Error("No formats found");
    }
}

export const fetchMetadata = async (props: Props) => {
    const {
        url, isPlaylist, useBrowserContext, bearerToken, referer,
        setStatus, setCurrentLog,
        setAvailableFormats, setSelectedFormat, setIsAnalyzed,
        childRef,
        limitPlaylist,
    } = props;

    if (!url) return;

    setStatus("analyzing");
    setCurrentLog(isPlaylist ? "Fetching playlist items..." : "Fetching available qualities...");

    const yt = isYouTube(url);
    const flags1 = getBrowserFlags(url, useBrowserContext, bearerToken, referer, false);
    const { jsonStr: json1, errorStr: err1 } = await runYtDlpDumpJson(url, isPlaylist, flags1, childRef, limitPlaylist);

    if (json1.trim()) {
        try {
            const { success, message } = parseAndApply(json1, isPlaylist, limitPlaylist, props);
            if (success) {
                setStatus("idle");
                setCurrentLog(message);
                return;
            }
            setStatus("error");
            setCurrentLog(message || "This URL does not contain downloadable media.");
            return;
        } catch {
        }
        setAvailableFormats([]);
        setSelectedFormat("best");
        setStatus("idle");
        setIsAnalyzed(true);
        setCurrentLog("Direct stream or un-parsable format detected.");
        return;
    }
    if (yt && useBrowserContext && needsYouTubeCookies(err1)) {
        setCurrentLog("Video may be private or age-restricted — retrying with browser cookies...");

        const flags2 = getBrowserFlags(url, useBrowserContext, bearerToken, referer, true);
        const { jsonStr: json2, errorStr: err2 } = await runYtDlpDumpJson(url, isPlaylist, flags2, childRef, limitPlaylist);

        if (json2.trim()) {
            try {
                const { success, message } = parseAndApply(json2, isPlaylist, limitPlaylist, props);
                if (success) {
                    setStatus("idle");
                    setCurrentLog(message);
                    return;
                }
                setStatus("error");
                setCurrentLog(message || "This URL does not contain downloadable media.");
                return;
            } catch { /* fall through */ }

            setAvailableFormats([]);
            setSelectedFormat("best");
            setStatus("idle");
            setIsAnalyzed(true);
            setCurrentLog("Direct stream or un-parsable format detected.");
            return;
        }
        const cookieErr = err2.toLowerCase();
        if (cookieErr.includes("database is locked") || cookieErr.includes("unable to open")) {
            setCurrentLog("Cookie error: close Chrome completely and try again.");
        } else if (cookieErr.includes("sign in") || cookieErr.includes("private")) {
            setCurrentLog("This video is private or requires a Google account login.");
        } else {
            setCurrentLog("Analysis failed even with cookies. The video may be unavailable.");
        }
        setStatus("error");
        return;
    }
    const e = err1.toLowerCase();
    if (e.includes("cookies") || e.includes("database is locked")) {
        setCurrentLog("Cookie error: close Chrome completely and try again.");
    } else if (e.includes("403")) {
        setCurrentLog("Access denied (403): check your token or referer.");
    } else if (e.includes("private") || e.includes("login")) {
        setCurrentLog("This content is private or requires login.");
    } else {
        setCurrentLog("Analysis failed. Enable browser context or check the URL.");
    }
    setStatus("error");
};