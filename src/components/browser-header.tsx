import { Globe, SlidersHorizontal } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import React, { useState } from "react";
import { SupportedBrowser, SUPPORTED_BROWSERS } from "@/lib/browser-flags";
import { cn } from "@/lib/utils";

type Props = {
    useBrowserContext: boolean;
    setUseBrowserContext: (useBrowserContext: boolean) => void;
    selectedBrowser: SupportedBrowser;
    setSelectedBrowser: (browser: SupportedBrowser) => void;
    bearerToken: string;
    setBearerToken: (bearerToken: string) => void;
    referer: string;
    setReferer: (referer: string) => void;
    status: "idle" | "analyzing" | "downloading" | "success" | "error";
    setPlaylistItems: (items: { index: number, title: string, duration?: number }[]) => void;
    setIsAnalyzed: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function BrowserHeader({
    setIsAnalyzed,
    setPlaylistItems,
    useBrowserContext,
    setUseBrowserContext,
    selectedBrowser,
    setSelectedBrowser,
    bearerToken,
    setBearerToken,
    referer,
    setReferer,
    status,
}: Props) {
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const hasCustomHeaders = Boolean(bearerToken.trim() || referer.trim());
    const isBusy = status === "downloading" || status === "analyzing";

    return (
        <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800 shadow-xs transition-colors">
            <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2.5 text-sm font-medium text-zinc-300 cursor-pointer select-none">
                    <Checkbox
                        checked={useBrowserContext}
                        onCheckedChange={(checked: boolean) => {
                            setUseBrowserContext(checked);
                            setIsAnalyzed(false);
                            if (!checked) setPlaylistItems([]);
                        }}
                        disabled={isBusy}
                        className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 accent-primary"
                    />
                    <div className="flex items-center gap-2">
                        <Globe className={cn("w-4 h-4 transition-colors", useBrowserContext ? "text-blue-400" : "text-zinc-500")} />
                        <span>Browser session</span>
                    </div>
                </label>

                {useBrowserContext && (
                    <div className="flex items-center gap-2">
                        <Select
                            value={selectedBrowser}
                            onValueChange={(value) => {
                                setSelectedBrowser(value as SupportedBrowser);
                                setIsAnalyzed(false);
                            }}
                            disabled={isBusy}
                        >
                            <SelectTrigger className="h-7 px-2.5 text-xs bg-zinc-950/80 border-zinc-800 hover:border-zinc-700 rounded-lg text-zinc-200 min-w-32">
                                <SelectValue placeholder="Select browser" />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200">
                                {SUPPORTED_BROWSERS.map((b) => (
                                    <SelectItem
                                        key={b.id}
                                        value={b.id}
                                        className="text-xs cursor-pointer focus:bg-zinc-800 focus:text-zinc-100"
                                    >
                                        {b.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                            disabled={isBusy}
                            className={cn(
                                "h-7 px-2 text-xs gap-1.5 transition-colors",
                                isAdvancedOpen
                                    ? "text-zinc-200 bg-zinc-800/60"
                                    : "text-zinc-400 hover:text-zinc-200"
                            )}
                            title="Configure custom headers"
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span>Headers</span>
                            {hasCustomHeaders && (
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            )}
                        </Button>
                    </div>
                )}
            </div>

            {useBrowserContext && isAdvancedOpen && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 mt-3 border-t border-zinc-800/80">
                    <div className="space-y-1.5">
                        <label className="text-xs text-zinc-400">Bearer token</label>
                        <Input
                            placeholder="Bearer token..."
                            value={bearerToken}
                            onChange={(e) => setBearerToken(e.target.value)}
                            className="h-8 text-xs font-mono bg-zinc-950 border-zinc-800 focus-visible:ring-1 focus-visible:ring-blue-500"
                            disabled={isBusy}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs text-zinc-400">Referer URL</label>
                        <Input
                            placeholder="https://..."
                            value={referer}
                            onChange={(e) => setReferer(e.target.value)}
                            className="h-8 text-xs font-mono bg-zinc-950 border-zinc-800 focus-visible:ring-1 focus-visible:ring-blue-500"
                            disabled={isBusy}
                        />
                    </div>
                    <p className="text-[11px] text-zinc-500 col-span-full">
                        Injected into metadata analysis and media download requests.
                    </p>
                </div>
            )}
        </div>
    );
}