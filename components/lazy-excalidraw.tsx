"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

export const LazyExcalidraw = dynamic(() => import("@/components/excalidraw-canvas"), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full flex items-center justify-center bg-muted/20">
            <div className="flex flex-col items-center gap-y-2">
                <Loader2 className="h-6 w-6 text-rose-500 animate-spin" />
                <p className="text-xs text-muted-foreground font-medium">Canvas Initializing...</p>
            </div>
        </div>
    )
});
