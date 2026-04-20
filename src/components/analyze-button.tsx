import { Button } from "./ui/button";
import { Loader2, Microscope } from "lucide-react";

type Props = {
    status: string;
    handleFetch: () => void;
    url: string;
}
export default function AnalyzeButton({ status, handleFetch, url }: Props) {
    return (
        <Button onClick={handleFetch} disabled={!url || status === "analyzing"} className="gap-2 w-40">
            {status === "analyzing" ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Microscope className="w-4 h-4" />Analyze Link</>}
        </Button>
    )
}