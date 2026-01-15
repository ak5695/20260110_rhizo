"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { useChat } from "@ai-sdk/react";
import { Loader2, X, Check, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExcalidrawStreaming } from "@/hooks/use-excalidraw-streaming";
import {
    parseCompactExcalidrawStreaming,
    convertCompactToExcalidraw
} from "@/lib/ai-excalidraw/excalidraw-converter";
import { layoutWithStrategy, LayoutStrategy } from "@/lib/ai-excalidraw/auto-layout-dagre";
import { cn } from "@/lib/utils";

const Excalidraw = dynamic(
    () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
    {
        ssr: false,
        loading: () => <div className="w-full h-full flex items-center justify-center bg-muted/20"><Loader2 className="animate-spin text-muted-foreground" /></div>
    }
);

interface ExcalidrawGenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
    position?: { top: number; left: number };
    initialPrompt: string;
    onInsert: (elements: any[]) => void;
}

export const ExcalidrawGenerationModal = ({
    isOpen,
    onClose,
    position,
    initialPrompt,
    onInsert
}: ExcalidrawGenerationModalProps) => {
    const [elements, setElements] = useState<any[]>([]);
    const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
    const [strategy, setStrategy] = useState<LayoutStrategy>('flowchart');
    const hasStartedRef = useRef(false);

    // 1. Determine layout strategy from prompt
    useEffect(() => {
        const p = initialPrompt.toLowerCase();
        if (p.includes('mindmap') || p.includes('mind map')) setStrategy('mindmap');
        else if (p.includes('flowchart') || p.includes('flow')) setStrategy('flowchart');
        else if (p.includes('architecture') || p.includes('system') || p.includes('module')) setStrategy('architecture');
        else if (p.includes('venn') || p.includes('set')) setStrategy('venn');
        else if (p.includes('chart') || p.includes('visualization') || p.includes('data')) setStrategy('dataviz');
        else if (p.includes('freeform') || p.includes('grid')) setStrategy('freeform');
        else setStrategy('flowchart'); // Default
    }, [initialPrompt]);

    // 5. Streaming & Layout Logic
    const { messages, append, isLoading } = useChat({
        api: "/api/generate-chart",
        body: {},
        onError: (err: any) => {
            console.error("Chart generation error:", err);
        }
    } as any) as any;

    // Use the streaming hook from "Your Provided Code"
    useExcalidrawStreaming({
        messages,
        setExcalidrawElements: setElements,
        strategy
    });

    // 3. Auto-start on open
    useEffect(() => {
        if (isOpen && initialPrompt && !hasStartedRef.current && append) {
            hasStartedRef.current = true;
            append({ role: 'user', content: initialPrompt });
        }
    }, [isOpen, initialPrompt, append]);

    // 4. Reset on close
    useEffect(() => {
        if (!isOpen) {
            hasStartedRef.current = false;
            setElements([]);
        }
    }, [isOpen]);

    // 6. Sync to Excalidraw Canvas
    useEffect(() => {
        if (excalidrawAPI && elements.length > 0) {
            try {
                excalidrawAPI.updateScene({ elements });
            } catch (e) { console.error("Excalidraw update error", e); }
        }
    }, [excalidrawAPI, elements]);

    // Auto-fit when done
    useEffect(() => {
        if (!isLoading && excalidrawAPI && elements.length > 0) {
            excalidrawAPI.scrollToContent(elements, { fitToContent: true, animate: true });
        }
    }, [isLoading, excalidrawAPI, elements]);


    if (!isOpen) return null;

    // Calculate Position
    // If provided, spawn below. If not, center.
    // Ensure it doesn't go off-screen.
    const rect = position ? {
        top: Math.min(position.top, window.innerHeight - 520),
        left: Math.max(20, Math.min(position.left - 300, window.innerWidth - 820))
    } : null;

    const style = rect ? {
        top: rect.top,
        left: rect.left,
    } : {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
    };

    return (
        <div
            className={cn(
                "fixed z-[99999] bg-background border border-border/50 shadow-2xl rounded-xl overflow-hidden flex flex-col transition-all duration-300 animate-in fade-in zoom-in-95",
                "backdrop-blur-xl bg-white/90 dark:bg-zinc-900/90 supports-[backdrop-filter]:bg-background/60"
            )}
            style={{
                width: 600,
                height: 400,
                ...style,
                position: 'fixed'
            }}
        >
            {/* Header */}
            <div className="h-10 border-b border-border/50 flex items-center px-4 justify-between bg-muted/30">
                <div className="flex items-center gap-2">
                    <div className={cn("p-1.5 rounded-md", isLoading ? "bg-amber-100 text-amber-600 animate-pulse" : "bg-green-100 text-green-600")}>
                        {isLoading ? <Wand2 className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-xs font-medium text-foreground/80">
                        {isLoading ? "Generating..." : "Ready"}
                    </span>
                    <span className="ml-2 text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {strategy}
                    </span>
                    {/* Error State */}
                    {!isLoading && elements.length === 0 && (
                        <span className="text-[10px] text-red-500 font-medium ml-2">
                            (No output)
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></Button>
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 relative bg-zinc-50/50 dark:bg-zinc-900/50">
                {/* Initial Loading State */}
                {elements.length === 0 && isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                        <span className="text-sm font-medium">Interpreting structure...</span>
                    </div>
                )}

                <Excalidraw
                    excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
                    initialData={{
                        elements: [],
                        appState: {
                            viewBackgroundColor: "#fafafa",
                            gridSize: 20,
                            viewModeEnabled: true, // Hide creation tools
                            zenModeEnabled: true   // Hide UI chrome
                        }
                    }}
                    // Minimal UI
                    viewModeEnabled={true}
                    zenModeEnabled={true}
                    UIOptions={{
                        canvasActions: {
                            changeViewBackgroundColor: false,
                            clearCanvas: false,
                            export: false,
                            loadScene: false,
                            saveToActiveFile: false,
                            toggleTheme: false,
                            saveAsImage: false,
                        }
                    }}
                />
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-border/50 bg-background/50 flex justify-between items-center">
                <div className="text-[10px] text-muted-foreground px-2">
                    {elements.length} elements generated
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-8">
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => { onInsert(elements); onClose(); }}
                        className="text-xs h-8 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-md border-0"
                        disabled={elements.length === 0}
                    >
                        Insert to Document
                    </Button>
                </div>
            </div>
        </div>
    );
}

// Ensure clean export
export default ExcalidrawGenerationModal;
