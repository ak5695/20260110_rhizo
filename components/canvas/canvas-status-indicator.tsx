"use client";

import { Loader2, Cloud, Check } from "lucide-react";

type SaveStatus = "idle" | "pending" | "saving";

interface CanvasStatusIndicatorProps {
    status: SaveStatus;
}

export const CanvasStatusIndicator = ({ status }: CanvasStatusIndicatorProps) => {
    return (
        <div className="absolute top-36 left-4 z-50 pointer-events-none flex items-center gap-2 px-3 py-1.5 bg-white/90 dark:bg-[#1e1e1e]/90 backdrop-blur rounded-full shadow-sm text-xs font-medium border border-gray-200 dark:border-gray-700 transition-all duration-300 origin-left">
            {status === "saving" && (
                <>
                    <Loader2 className="w-3 h-3 animate-spin text-orange-500" />
                    <span className="text-orange-600 dark:text-orange-400">Saving...</span>
                </>
            )}
            {status === "idle" && (
                <>
                    <Cloud className="w-3 h-3 text-gray-400" />
                    <Check className="w-2.5 h-2.5 text-green-500 -ml-1" />
                    <span className="text-gray-500 dark:text-gray-400">Saved</span>
                </>
            )}
            {status === "pending" && (
                <>
                    <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                    <span className="text-gray-500 dark:text-gray-400">Changed</span>
                </>
            )}
        </div>
    );
};
