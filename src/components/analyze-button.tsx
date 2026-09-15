import { Button } from "./ui/button";
import { Loader2, Microscope, LaptopMinimalCheck } from "lucide-react";

type Props = {
    status: string;
    handleFetch: () => void;
    url: string;
    isAnalyzed?: boolean;
};

export default function AnalyzeButton({ status, handleFetch, url, isAnalyzed }: Props) {
    const isAnalyzing = status === "analyzing";
    const isDownloading = status === "downloading";
    const isDisabled = !url || isAnalyzing || isDownloading || isAnalyzed;

    return (
        <Button
            onClick={handleFetch}
            disabled={isDisabled}
            className="gap-2 w-36 shrink-0 cursor-pointer"
        >
            {isAnalyzing ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing...</span>
                </>
            ) : isAnalyzed ? (
                <>
                    <LaptopMinimalCheck className="w-4 h-4 text-emerald-400" />
                    <span>Analyzed</span>
                </>
            ) : (
                <>
                    <Microscope className="w-4 h-4" />
                    <span>Analyze</span>
                </>
            )}
        </Button>
    );
}