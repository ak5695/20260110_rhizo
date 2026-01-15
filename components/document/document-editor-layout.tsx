"use client";

import { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import debounce from "lodash.debounce";
import { Group, Panel, Separator } from "react-resizable-panels";
import { cn } from "@/lib/utils";

import { Skeleton } from "@/components/ui/skeleton";
import { Toolbar } from "@/components/toolbar";
import { Cover } from "@/components/cover";
import { Navbar } from "@/components/main/navbar";

import { AiChatModal } from "@/components/ai-chat-modal";
import { DocumentOutline } from "@/components/document-outline";
import { QaList } from "@/components/qa-list";

import {
    useLayoutStore,
    useCanvasOpen,
    useCanvasFullscreen,
    useOutlineOpen,
    useQaListOpen
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

    // Helper to parse content optimistically
    const parseInitialContent = useMemo(() => {
        return (contentJson: string | null) => {
            if (!contentJson) return [];
            try {
                return JSON.parse(contentJson);
            } catch (e) {
                console.error("Failed to parse initial content for outline", e);
                return [];
            }
        };
    }, []);

    // UI State - Initialize from prop immediately for instant render
    const [editorDocument, setEditorDocument] = useState<any>(() => {
        return parseInitialContent(document.content);
    });

    // Reset/Update outline when document changes
    useEffect(() => {
        // Optimistically set content from props while waiting for editor
        setEditorDocument(parseInitialContent(document.content));
    }, [documentId, document.content, parseInitialContent]);

    // Debounce outline updates from editor (keep this for live typing updates)
    const debouncedSetEditorDocument = useMemo(
        () => debounce((doc: any) => setEditorDocument(doc), 1000),
        []
    );

    useEffect(() => {
        return () => {
            debouncedSetEditorDocument.cancel();
        };
    }, [debouncedSetEditorDocument]);

    // Layout Store
    const isCanvasOpen = useCanvasOpen();
    const isCanvasFullscreen = useCanvasFullscreen();
    const isOutlineOpen = useOutlineOpen();
    const isQaListOpen = useQaListOpen();
    const { toggleCanvas, toggleFullscreen, toggleOutline, toggleQaList, openCanvas } = useLayoutStore();

    // Global AI Chat State
    const [globalAiChat, setGlobalAiChat] = useState<{ isOpen: boolean, initialInput: string }>({
        isOpen: false,
        initialInput: ""
    });

    const handleQaAsk = (prompt: string) => {
        setGlobalAiChat({
            isOpen: true,
            initialInput: prompt
        });
    };

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
            <Group orientation="horizontal">

                {/* Editor Panel */}
                <Panel
                    className={cn("flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out", isCanvasFullscreen && "hidden")}
                    defaultSize={50}
                    minSize={20}
                    id="editor-panel"
                >
                    <div className="flex flex-col h-full relative">
                        {/* Navbar */}
                        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40">
                            <Navbar
                                initialData={document}
                                isCanvasOpen={isCanvasOpen}
                                onToggleCanvas={toggleCanvas}
                                isOutlineOpen={isOutlineOpen}
                                onToggleOutline={toggleOutline}
                            />
                        </div>

                        {/* Flex Container for Content AND Sibilng Drawers (Push Layout) */}
                        <div className="flex-1 flex flex-row overflow-hidden relative">
                            {/* Content Scroll Area - Flex Grow */}
                            <div className="flex-1 h-full overflow-y-auto custom-scrollbar min-w-0">
                                <div className="pb-40">
                                    <Cover url={document.coverImage} />
                                    <div className="md:max-w-3xl lg:max-w-4xl mx-auto">
                                        <Toolbar initialData={document} />
                                        <Editor
                                            onChange={onChange}
                                            initialContent={document.content}
                                            userId={document.userId}
                                            documentId={documentId}
                                            onDocumentChange={debouncedSetEditorDocument}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Outline Sidebar - Flex Sibling */}
                            <div
                                className={cn(
                                    "h-full bg-background/80 backdrop-blur-xl border-l border-border/50 z-40 shrink-0",
                                    "transition-[width] duration-300 ease-in-out overflow-hidden",
                                    isOutlineOpen ? "w-80" : "w-0"
                                )}
                            >
                                <div className="w-80 h-full">
                                    <DocumentOutline
                                        editorDocument={editorDocument}
                                        className="h-full overflow-y-auto custom-scrollbar"
                                        onClose={toggleOutline}
                                    />
                                </div>
                            </div>



                            {/* Q&A Sidebar - Flex Sibling */}
                            <div
                                className={cn(
                                    "h-full bg-background/80 backdrop-blur-xl border-l border-border/50 z-40 shrink-0",
                                    "transition-[width] duration-300 ease-in-out overflow-hidden",
                                    isQaListOpen ? "w-80" : "w-0"
                                )}
                            >
                                <div className="w-80 h-full">
                                    <QaList
                                        onClose={toggleQaList}
                                        onAsk={handleQaAsk}
                                    />
                                </div>
                            </div>

                            {/* Global AI Chat Modal */}
                            <AiChatModal
                                isOpen={globalAiChat.isOpen}
                                onClose={() => setGlobalAiChat(prev => ({ ...prev, isOpen: false }))}
                                initialInput={globalAiChat.initialInput}
                                autoSubmit={true}
                                onInsertText={(text) => {
                                    // Just close for now, user can copy or we can try to insert if we have editor access
                                    // Since we don't have direct access to editor instance here easily without prop drilling,
                                    // we rely on the manual "Insert" button in the modal which calls this.
                                    // However, the AiChatModal in Editor has access to editor instance.
                                    // This global one is strictly for Q&A where usually they just want the answer.
                                    // But user asked to "Insert answer with question summary".
                                    // To support insertion, we need to pass a callback that Editor listens to?
                                    // Or simply rely on copy-paste for this specific workflow?
                                    // The user requirement said: "When user inserts answer, it brings a secondary heading".
                                    // This logic resides in AiChatModal.
                                    // If we use this global modal, we need to know WHERE to insert.
                                    // WE CAN'T insert into BlockNote from here easily.
                                    // WORKAROUND: Dispatch a custom event that Editor listens to.
                                    window.dispatchEvent(new CustomEvent("editor:insert-text", { detail: text }));
                                }}
                            />
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
                        id="canvas-panel"
                    >
                        <div className="flex-1 relative border-l border-white/5 overflow-hidden shadow-inner">
                            <ExcalidrawCanvas
                                key={documentId}
                                documentId={documentId}
                            />
                        </div>
                    </Panel>
                )}

            </Group>
        </div>
    );
};
