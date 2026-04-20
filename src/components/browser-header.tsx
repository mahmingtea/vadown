import { Globe } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import React, { useState } from "react";

type Props = {
    useBrowserContext: boolean;
    setUseBrowserContext: (useBrowserContext: boolean) => void;
    bearerToken: string;
    setBearerToken: (bearerToken: string) => void;
    referer: string;
    setReferer: (referer: string) => void;
    status: "idle" | "analyzing" | "downloading" | "success" | "error";
    setPlaylistItems: (items: { index: number, title: string, duration?: number }[]) => void;
    setIsAnalyzed: React.Dispatch<React.SetStateAction<boolean>>
}
export default function BrowserHeader({ setIsAnalyzed, setPlaylistItems, useBrowserContext, setUseBrowserContext, bearerToken, setBearerToken, referer, setReferer, status }: Props) {
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    return (
        <div className="space-y-0 p-3 bg-zinc-900/40 rounded-xl border border-zinc-800 shadow-inner">
            <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 text-sm font-medium text-muted-foreground cursor-pointer select-none">
                    <Checkbox
                        checked={useBrowserContext}
                        onCheckedChange={(checked: boolean) => {
                            setUseBrowserContext(checked);
                            setIsAnalyzed(false);
                            if (!checked) setPlaylistItems([]);
                        }}
                        disabled={status === "downloading" || status === "analyzing"}
                        className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 accent-primary"
                    />
                    <div className="flex items-center gap-2">
                        <Globe className={`w-4 h-4 ${useBrowserContext ? "text-blue-400" : ""}`} />
                        <span>Use Chrome Browser Context (Advanced)</span>
                    </div>
                </label>
                {useBrowserContext && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                        className="h-7 px-2 text-[10px] text-zinc-500 hover:text-zinc-300 gap-1 uppercase tracking-tighter"
                    >
                        {isAdvancedOpen ? "Hide Headers" : "Edit Headers"}
                    </Button>
                )}
            </div>
            {useBrowserContext && isAdvancedOpen && (
                <div className="grid grid-cols-1 gap-4 pt-4 pb-2 animate-in slide-in-from-top-1 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-bold uppercase text-zinc-500">Bearer Token</label>
                                {bearerToken && <Badge variant="secondary" className="h-3 text-[8px] px-1 bg-blue-500/10 text-blue-400 border-0">Active</Badge>}
                            </div>
                            <Input
                                placeholder="Authorization: Bearer..."
                                value={bearerToken}
                                onChange={(e) => setBearerToken(e.target.value)}
                                className="h-8 text-[11px] font-mono bg-zinc-950 border-zinc-800 focus-visible:ring-1 focus-visible:ring-blue-500"
                                disabled={status === "downloading" || status === "analyzing"}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase text-zinc-500 px-1">Referer URL</label>
                            <Input
                                placeholder="e.g. https://www.youtube.com"
                                value={referer}
                                onChange={(e) => setReferer(e.target.value)}
                                className="h-8 text-[11px] font-mono bg-zinc-950 border-zinc-800 focus-visible:ring-1 focus-visible:ring-blue-500"
                                disabled={status === "downloading" || status === "analyzing"}
                            />
                        </div>
                    </div>
                    <p className="text-[10px] text-zinc-600 italic px-1">
                        Headers will be injected into all metadata and download requests.
                    </p>
                </div>
            )}
        </div>)
}