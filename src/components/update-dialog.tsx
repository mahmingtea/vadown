import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import {
    RefreshCw,
    Download,
    Loader2,
    Sparkles,
    X,
    ArrowUpCircle,
    Cpu,
    AppWindow
} from "lucide-react";

export type YtDlpUpdateInfo = {
    current_version: string;
    latest_version: string;
    update_available: boolean;
    active_path: string;
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    appVersion: string;
    onUpdateStatusChange?: (hasUpdate: boolean) => void;
    initialAppUpdate?: Update | null;
    initialYtdlpInfo?: YtDlpUpdateInfo | null;
};

export default function UpdateDialog({
    isOpen,
    onClose,
    appVersion,
    onUpdateStatusChange,
    initialAppUpdate,
    initialYtdlpInfo,
}: Props) {
    // App updater states
    const [checkingApp, setCheckingApp] = useState(false);
    const [appUpdate, setAppUpdate] = useState<Update | null>(null);
    const [appUpdateDownloaded, setAppUpdateDownloaded] = useState(false);
    const [appDownloadProgress, setAppDownloadProgress] = useState(0);
    const [appInstalling, setAppInstalling] = useState(false);
    const [appStatusText, setAppStatusText] = useState("");

    // yt-dlp updater states
    const [checkingYtdlp, setCheckingYtdlp] = useState(false);
    const [updatingYtdlp, setUpdatingYtdlp] = useState(false);
    const [ytdlpInfo, setYtdlpInfo] = useState<YtDlpUpdateInfo | null>(null);
    const [ytdlpStatusText, setYtdlpStatusText] = useState("");

    useEffect(() => {
        if (isOpen) {
            const hasInitialUpdates = Boolean(initialAppUpdate || initialYtdlpInfo?.update_available);
            if (hasInitialUpdates) {
                if (initialAppUpdate) {
                    setAppUpdate(initialAppUpdate);
                    setAppStatusText(`Version ${initialAppUpdate.version} is available!`);
                } else {
                    setAppUpdate(null);
                    setAppStatusText("You are on the latest version.");
                }

                if (initialYtdlpInfo) {
                    setYtdlpInfo(initialYtdlpInfo);
                    if (initialYtdlpInfo.update_available) {
                        setYtdlpStatusText(`Update available: ${initialYtdlpInfo.latest_version}`);
                    } else {
                        setYtdlpStatusText("yt-dlp is up to date.");
                    }
                }
            } else {
                handleCheckAll();
            }
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && onUpdateStatusChange) {
            const hasAny = Boolean(appUpdate || ytdlpInfo?.update_available);
            onUpdateStatusChange(hasAny);
        }
    }, [isOpen, appUpdate, ytdlpInfo?.update_available, onUpdateStatusChange]);

    const handleCheckAll = () => {
        checkAppUpdate();
        checkYtdlpUpdate();
    };

    const checkAppUpdate = async () => {
        setCheckingApp(true);
        setAppStatusText("Checking GitHub for app updates...");
        try {
            const update = await check();
            if (update) {
                setAppUpdate(update);
                setAppStatusText(`Version ${update.version} is available!`);
            } else {
                setAppUpdate(null);
                setAppStatusText("You are on the latest version.");
            }
        } catch (err: any) {
            console.warn("App update check error:", err);
            setAppStatusText(String(err?.message || err).slice(0, 100));
        } finally {
            setCheckingApp(false);
        }
    };

    const installAppUpdate = async () => {
        if (!appUpdate) return;
        setAppInstalling(true);
        setAppStatusText("Downloading update package...");
        try {
            let downloaded = 0;
            let total = 0;
            await appUpdate.downloadAndInstall((event) => {
                switch (event.event) {
                    case "Started":
                        total = event.data.contentLength || 0;
                        break;
                    case "Progress":
                        downloaded += event.data.chunkLength;
                        if (total > 0) {
                            setAppDownloadProgress(Math.round((downloaded / total) * 100));
                        }
                        break;
                    case "Finished":
                        setAppDownloadProgress(100);
                        setAppUpdateDownloaded(true);
                        setAppStatusText("Update downloaded! Restarting...");
                        break;
                }
            });
            await relaunch();
        } catch (err: any) {
            console.error("Failed to install app update:", err);
            setAppStatusText(`Update error: ${err?.message || err}`);
            setAppInstalling(false);
        }
    };

    const checkYtdlpUpdate = async () => {
        setCheckingYtdlp(true);
        setYtdlpStatusText("Checking latest yt-dlp upstream release...");
        try {
            const info = await invoke<YtDlpUpdateInfo>("check_ytdlp_update");
            setYtdlpInfo(info);
            if (info.update_available) {
                setYtdlpStatusText(`Update available: ${info.latest_version}`);
            } else {
                setYtdlpStatusText("yt-dlp engine is up to date.");
            }
        } catch (err: any) {
            console.error("yt-dlp check error:", err);
            setYtdlpStatusText(String(err).slice(0, 100));
        } finally {
            setCheckingYtdlp(false);
        }
    };

    const installYtdlpUpdate = async () => {
        setUpdatingYtdlp(true);
        setYtdlpStatusText("Downloading latest binary from GitHub...");
        try {
            const newVer = await invoke<string>("install_ytdlp_update");
            setYtdlpStatusText(`Successfully updated to ${newVer}!`);
            await checkYtdlpUpdate();
        } catch (err: any) {
            console.error("Failed to update yt-dlp:", err);
            setYtdlpStatusText(`Failed to update: ${String(err).slice(0, 100)}`);
        } finally {
            setUpdatingYtdlp(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                    <div className="flex items-center gap-2">
                        <ArrowUpCircle className="w-5 h-5 text-blue-400" />
                        <h2 className="text-lg font-semibold tracking-tight text-white">Software Updates</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content Cards */}
                <div className="space-y-4">
                    {/* Card 1: VADown Application */}
                    <Card className="bg-zinc-900/60 border-zinc-800">
                        <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                        <AppWindow className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-white">VADown App</span>
                                            <Badge variant="outline" className="text-[10px] h-4 font-mono">
                                                v{appVersion || "0.2.1"}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-zinc-400 mt-0.5">{appStatusText || "Checking..."}</p>
                                    </div>
                                </div>

                                <div>
                                    {appUpdate ? (
                                        <Button
                                            size="sm"
                                            onClick={installAppUpdate}
                                            disabled={appInstalling}
                                            className="h-7 text-xs gap-1.5 bg-blue-600 hover:bg-blue-500"
                                        >
                                            {appInstalling ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Download className="w-3.5 h-3.5" />
                                            )}
                                            {appUpdateDownloaded ? "Restarting..." : "Update & Restart"}
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={checkAppUpdate}
                                            disabled={checkingApp}
                                            className="h-7 text-xs gap-1.5 border-zinc-700"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${checkingApp ? "animate-spin" : ""}`} />
                                            Check
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {appInstalling && (
                                <div className="space-y-1.5 pt-1">
                                    <div className="flex justify-between text-[11px] text-zinc-400">
                                        <span>Downloading update...</span>
                                        <span>{appDownloadProgress}%</span>
                                    </div>
                                    <Progress value={appDownloadProgress} className="h-1.5" />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Card 2: yt-dlp Engine */}
                    <Card className="bg-zinc-900/60 border-zinc-800">
                        <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                                        <Cpu className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-white">yt-dlp Engine</span>
                                            {ytdlpInfo?.current_version && (
                                                <Badge variant="outline" className="text-[10px] h-4 font-mono text-emerald-400 border-emerald-500/30">
                                                    {ytdlpInfo.current_version}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-zinc-400 mt-0.5">{ytdlpStatusText || "Checking..."}</p>
                                    </div>
                                </div>

                                <div>
                                    <Button
                                        size="sm"
                                        onClick={installYtdlpUpdate}
                                        disabled={updatingYtdlp || checkingYtdlp}
                                        className={`h-7 text-xs gap-1.5 ${
                                            ytdlpInfo?.update_available
                                                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                                : "border-zinc-700 text-zinc-200"
                                        }`}
                                        variant={ytdlpInfo?.update_available ? "default" : "outline"}
                                    >
                                        {updatingYtdlp ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : ytdlpInfo?.update_available ? (
                                            <Sparkles className="w-3.5 h-3.5" />
                                        ) : (
                                            <RefreshCw className="w-3.5 h-3.5" />
                                        )}
                                        {ytdlpInfo?.update_available ? "Update yt-dlp" : "Re-check / Force Update"}
                                    </Button>
                                </div>
                            </div>
                            <p className="text-[11px] text-zinc-500 italic">
                                Updating yt-dlp fixes extractor issues (e.g. YouTube algorithm changes) instantly without reinstalling VADown.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Footer buttons */}
                <div className="flex justify-end gap-2 pt-1">
                    <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs text-zinc-400 hover:text-white">
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}
