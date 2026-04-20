import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { downloadDir } from "@tauri-apps/api/path";
import { openPath } from '@tauri-apps/plugin-opener';

type Props = {
    status: "idle" | "analyzing" | "downloading" | "success" | "error";
    currentLog: string;
    duration: string | null;
    elapsedTime: number;
    progress: number;
    isPlaylist: boolean;
    handleStop: () => void;
    handleNewDownload: () => void;
    formatDuration: (duration: number) => string;
}
export default function ProgressCard({ status, currentLog, duration, elapsedTime, progress, isPlaylist, handleStop, handleNewDownload, formatDuration }: Props) {
    const handleOpenDownloads = async () => {
        try {
            const downloadDirPath = await downloadDir();
            await openPath(downloadDirPath);
        } catch (error) {
            console.error("Failed to open directory:", error);
        }
    };
    return (
        <Card className={status === "success" ? "border-green-500/50 bg-green-500/5" : status === "error" ? "border-red-500/50 bg-red-500/5" : ""}>
            <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between text-sm gap-4">

                    <div className="flex items-center gap-2 font-medium min-w-0 flex-1">
                        {status === "success" ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                        ) : status === "error" ? (
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                        ) : (
                            <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                        )}
                        <span className="truncate block text-xs">
                            {status === "success" ? (isPlaylist ? "Playlist items downloaded!" : "All Done!") : currentLog}
                        </span>
                    </div>

                    {(status === "downloading" || status === "success") && (
                        <Badge variant="outline" className="shrink-0 text-[10px] bg-zinc-500/10 border-zinc-500/20 font-mono">
                            {status === "success" && duration ? `Took ${duration}` : formatDuration(elapsedTime)}
                        </Badge>
                    )}

                    {status === "downloading" && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleStop}
                            className="h-6 px-3 text-red-500 hover:text-red-600 hover:bg-red-500/10 shrink-0"
                        >
                            <XCircle className="w-4 h-4 mr-1" /> Stop
                        </Button>
                    )}

                    {status === "success" || status === "error" ? (
                        <Button onClick={handleNewDownload} size="sm" variant="outline" className="h-6 px-3 shrink-0">
                            Clear
                        </Button>
                    ) : (
                        <Badge variant="secondary" className="shrink-0 capitalize">
                            {status}
                        </Badge>
                    )}
                    {status === "success" ? (
                        <Button onClick={handleOpenDownloads} size="sm" variant="outline" className="h-6 px-3 shrink-0">
                            Open Folder
                        </Button>
                    ) : (
                        null
                    )}
                </div>

                <Progress value={progress} className="h-2 transition-all duration-300" />
            </CardContent>
        </Card>)
}