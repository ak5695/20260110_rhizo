"use client";

import { Loader2, Cloud, Check } from "lucide-react";

type SaveStatus = "idle" | "pending" | "saving";

interface CanvasStatusIndicatorProps {
    status: SaveStatus;
}

export const CanvasStatusIndicator = ({ status }: CanvasStatusIndicatorProps) => {
    return (
        <div className="absolute bottom-16 right-4 z-50 pointer-events-none flex items-center justify-center gap-1.5 px-2 py-1 bg-white/80 dark:bg-[#1e1e1e]/80 backdrop-blur-md rounded-full shadow-sm text-[10px] font-medium border border-gray-100 dark:border-gray-800 transition-all duration-300 origin-right hover:bg-white/95 dark:hover:bg-[#1e1e1e]/95">
            {status === "saving" && (
                <>
                    <Loader2 className="w-2.5 h-2.5 animate-spin text-muted-foreground" />
                    <span className="text-muted-foreground hidden sm:inline">Saving</span>
                </>
            )}
            {status === "idle" && (
                <>
                    <Cloud className="w-3 h-3 text-muted-foreground/60" />
                    <Check className="w-2 h-2 text-green-500/80 -ml-1.5 mt-1" />
                </>
            )}
            {status === "pending" && (
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400/80 animate-pulse" />
            )}
        </div>
    );
};
