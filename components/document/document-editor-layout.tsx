"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { cn } from "@/lib/utils";

import { Skeleton } from "@/components/ui/skeleton";
import { Toolbar } from "@/components/toolbar";
import { Cover } from "@/components/cover";
import { Navbar } from "@/components/main/navbar";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { DocumentOutline } from "@/components/document-outline";

import {
    useLayoutStore,
    useCanvasOpen,
    useCanvasFullscreen,
    useOutlineOpen
} from "@/store/use-layout-store";

interface DocumentEditorLayoutProps {
    document: any;
    documentId: string;
    onChange: (content: string) => void;
}

export const DocumentEditorLayout = ({
    document,
    documentId,
    onChange
}: DocumentEditorLayoutProps) => {
    // UI State
    const [editorDocument, setEditorDocument] = useState<any>(null);

    // Layout Store
    const isCanvasOpen = useCanvasOpen();
    const isCanvasFullscreen = useCanvasFullscreen();
    const isOutlineOpen = useOutlineOpen();
    const { toggleCanvas, toggleFullscreen, toggleOutline, openCanvas } = useLayoutStore();

    // Lazy Components
    const Editor = useMemo(
        () => dynamic(() => import("@/components/editor"), {
            ssr: false,
            loading: () => (
                <div className="space-y-4 pt-4">
                    <Skeleton className="h-4 w-[80%]" />
                    <Skeleton className="h-4 w-[40%]" />
                    <Skeleton className="h-4 w-[60%]" />
                </div>
            )
        }),
        [],
    );

    const ExcalidrawCanvas = useMemo(
        () => dynamic(() => import("@/components/excalidraw-canvas"), {
            ssr: false,
            loading: () => (
                <div className="h-full w-full flex items-center justify-center bg-muted/20">
                    <div className="flex flex-col items-center gap-y-2">
                        <Loader2 className="h-6 w-6 text-rose-500 animate-spin" />
                        <p className="text-xs text-muted-foreground font-medium">Canvas Initializing...</p>
                    </div>
                </div>
            )
        }),
        [],
    );

    return (
        <div className="h-full w-full bg-background dark:bg-[#1F1F1F] overflow-hidden">
            <Group direction="horizontal">

                {/* Editor Panel */}
                <Panel
                    className={cn("flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out", isCanvasFullscreen && "hidden")}
                    defaultSize={50}
                    minSize={20}
                    order={1}
                    id="editor-panel"
                >
                    <div className="flex flex-col h-full relative">
                        {/* Navbar */}
                        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40">
                            <Navbar
                                isCanvasOpen={isCanvasOpen}
                                onToggleCanvas={toggleCanvas}
                                isOutlineOpen={isOutlineOpen}
                                onToggleOutline={toggleOutline}
                            />
                        </div>

                        {/* Content Scroll Area */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                            <div className="pb-40">
                                <Cover url={document.coverImage} />
                                <div className="md:max-w-3xl lg:max-w-4xl mx-auto">
                                    <Toolbar initialData={document} />
                                    <Editor
                                        onChange={onChange}
                                        initialContent={document.content}
                                        userId={document.userId}
                                        documentId={documentId}
                                        onDocumentChange={setEditorDocument}
                                    />
                                </div>
                            </div>

                            {/* Outline - Absolute to Editor Panel */}
                            {isOutlineOpen && (
                                <div className="fixed top-24 bottom-4 right-6 w-64 bg-background/95 backdrop-blur-md border border-border/40 rounded-xl shadow-xl overflow-hidden z-40 hidden xl:block animate-in fade-in slide-in-from-right-4">
                                    <DocumentOutline editorDocument={editorDocument} className="h-full overflow-y-auto custom-scrollbar" />
                                </div>
                            )}
                        </div>
                    </div>
                </Panel>

                {/* Resize Handle (Separator) */}
                {isCanvasOpen && !isCanvasFullscreen && (
                    <Separator className="w-2 bg-transparent hover:bg-primary/10 transition-colors flex items-center justify-center group/handle z-50 outline-none cursor-col-resize -ml-[4px] -mr-[4px] relative">
                        <div className="w-[1px] h-full bg-border/40 group-hover/handle:bg-primary/50 transition-all shadow-[0_0_10px_rgba(0,0,0,0.05)]" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-muted-foreground/20 rounded-full group-hover/handle:bg-primary/40 transition-colors opacity-0 group-hover/handle:opacity-100" />
                    </Separator>
                )}

                {/* Canvas Panel */}
                {isCanvasOpen && (
                    <Panel
                        className={cn("flex flex-col h-full bg-muted/5", isCanvasFullscreen && "w-full flex-1")}
                        defaultSize={50}
                        minSize={20}
                        order={2}
                        id="canvas-panel"
                    >
                        <div className="flex-1 relative border-l border-white/5 overflow-hidden shadow-inner">
                            <ExcalidrawCanvas
                                documentId={documentId}
                            />
                        </div>
                    </Panel>
                )}

            </Group>

            <SelectionToolbar
                documentId={documentId}
                onEnsureCanvas={openCanvas}
            />
        </div>
    );
};
