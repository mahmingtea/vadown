import { Button } from "./ui/button";
import { Download, Loader2 } from "lucide-react";

type Props = {
    isPlaylist: boolean;
    selectedItems: number[];
    status: string;
    handleDownload: () => void;
    url: string;
}
export default function DownloadButton({ isPlaylist, selectedItems, status, handleDownload, url }: Props) {
    return (
        <Button onClick={handleDownload} disabled={!url || status === "downloading"} className="gap-2 w-40">
            {status === "downloading" ? <><Loader2 className="w-4 h-4 animate-spin" /> Working...</> : (
                <><Download className="w-4 h-4" /> {isPlaylist ? `Download (${selectedItems.length})` : "Download"}</>
            )}
        </Button>
    )
}