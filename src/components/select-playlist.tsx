import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";

type Props = {
    setLimitPlaylist: (limitPlaylist: boolean) => void;
    isPlaylist: boolean;
    setIsPlaylist: (isPlaylist: boolean) => void;
    status: string;
    setAvailableFormats: (availableFormats: any[]) => void;
    setIsAnalyzed: (isAnalyzed: boolean) => void;
    setVideoInfo: (videoInfo: any) => void;
    setPlaylistItems: (playlistItems: any[]) => void;
}
export default function SelectPlaylist({ setLimitPlaylist, isPlaylist, setIsPlaylist, status, setAvailableFormats, setIsAnalyzed, setVideoInfo, setPlaylistItems }: Props) {
    return (
        <div className="flex items-center space-x-4 px-1">
            <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-pointer">
                <Checkbox
                    checked={isPlaylist}
                    onCheckedChange={(checked: boolean) => {
                        setIsPlaylist(checked);
                        setAvailableFormats([]);
                        setIsAnalyzed(false);
                        setVideoInfo(null);
                        setPlaylistItems([]);
                    }}
                    disabled={status === "downloading" || status === "analyzing"}
                    className="rounded border-zinc-700 bg-zinc-900"
                />
                Process as Playlist
            </label>
            {isPlaylist && <div className="flex-1">
                <RadioGroup defaultValue="max50" className="w-full" orientation="horizontal" onValueChange={(value) => {
                    if (value === "max50") {
                        setLimitPlaylist(true)
                        setIsAnalyzed(false)
                    } else {
                        setLimitPlaylist(false)
                        setIsAnalyzed(false)
                    }
                }}>
                    <div className="flex flex-row gap-4">
                        <div className="flex items-center gap-1">
                            <RadioGroupItem value="max50" id="r1" />
                            <Label htmlFor="r1">MAX 50</Label>
                        </div>
                        <div className="flex items-center gap-1">
                            <RadioGroupItem value="unlimited" id="r2" />
                            <Label htmlFor="r2">Unlimited list</Label>
                        </div>
                    </div>

                </RadioGroup>
            </div>}
        </div>
    )
}