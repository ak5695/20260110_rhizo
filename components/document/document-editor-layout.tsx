"use client";

import { useState, memo } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Sparkles } from "lucide-react";

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

import { LazyEditor as Editor } from "@/components/lazy-editor";
import { LazyExcalidraw as ExcalidrawCanvas } from "@/components/lazy-excalidraw";

interface DocumentEditorLayoutProps {
    document: any;
    documentId: string;
    onChange: (content: string) => void;
}

const DocumentEditorLayoutComponent = ({
    document,
    documentId,
    onChange
}: DocumentEditorLayoutProps) => {

    const isMobile = useMediaQuery("(max-width: 768px)");

    // Layout Store
    const isCanvasOpen = useCanvasOpen();
    const isCanvasFullscreen = useCanvasFullscreen();
    const isOutlineOpen = useOutlineOpen();
    const isQaListOpen = useQaListOpen();

    const toggleCanvas = useLayoutStore(state => state.toggleCanvas);
    const toggleFullscreen = useLayoutStore(state => state.toggleFullscreen);
    const toggleOutline = useLayoutStore(state => state.toggleOutline);
    const toggleQaList = useLayoutStore(state => state.toggleQaList);
    const openCanvas = useLayoutStore(state => state.openCanvas);

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

    return (
        <div className="h-full w-full bg-background dark:bg-[#1F1F1F] flex flex-col overflow-hidden">
            {/* Top-Level Persistent Navbar - Mobile Only */}
            {isMobile && (
                <div className="shrink-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40">
                    <Navbar
                        initialData={document}
                        isCanvasOpen={isCanvasOpen}
                        onToggleCanvas={toggleCanvas}
                        isOutlineOpen={isOutlineOpen}
                        onToggleOutline={toggleOutline}
                    />
                </div>
            )}

            <div className="flex-1 overflow-hidden relative">
                <Group orientation={isMobile && isCanvasOpen ? "vertical" : "horizontal"}>

                    {/* Editor Panel - Conditionally Rendered to fix layout issues when hidden */}
                    {!isCanvasFullscreen && (
                        <Panel
                            className="flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out"
                            defaultSize={50}
                            minSize={20}
                            id="editor-panel"
                        >
                            <div className="flex flex-col h-full relative">
                                {/* Desktop Navbar - Inside Editor Panel */}
                                {!isMobile && (
                                    <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40">
                                        <Navbar
                                            initialData={document}
                                            isCanvasOpen={isCanvasOpen}
                                            onToggleCanvas={toggleCanvas}
                                            isOutlineOpen={isOutlineOpen}
                                            onToggleOutline={toggleOutline}
                                        />
                                    </div>
                                )}

                                <div className="flex-1 flex flex-row overflow-hidden relative">
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
                                                />
                                                {/* Sticky Mobile AI Button - Aligned to Content Area */}
                                                {isMobile && !globalAiChat.isOpen && (
                                                    <div className="sticky bottom-10 z-30 pointer-events-none flex justify-end px-4">
                                                        <div
                                                            role="button"
                                                            onClick={() => setGlobalAiChat({ isOpen: true, initialInput: "" })}
                                                            className="pointer-events-auto h-12 w-12 rounded-full bg-rose-600 text-white shadow-xl flex items-center justify-center cursor-pointer hover:bg-rose-700 active:scale-95 transition-all group relative"
                                                        >
                                                            <Sparkles className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                                                            <div className="absolute inset-0 rounded-full bg-rose-600 animate-pulse -z-10 opacity-50" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Outline Sidebar */}
                                    <div
                                        className={cn(
                                            "h-full bg-background dark:bg-[#1F1F1F] border-l border-border/50 z-[60] overflow-hidden",
                                            isMobile
                                                ? "fixed inset-0 w-full transition-transform duration-300"
                                                : "shrink-0 transition-[width] duration-300 ease-in-out",
                                            isMobile
                                                ? (isOutlineOpen ? "translate-x-0" : "translate-x-full")
                                                : (isOutlineOpen ? "w-80" : "w-0")
                                        )}
                                    >
                                        <div className={cn("h-full", isMobile ? "w-full" : "w-80")}>
                                            <DocumentOutline
                                                className="h-full overflow-y-auto custom-scrollbar"
                                                onClose={toggleOutline}
                                            />
                                        </div>
                                    </div>

                                    {/* Q&A Sidebar */}
                                    <div
                                        className={cn(
                                            "h-full bg-background dark:bg-[#1F1F1F] border-l border-border/50 z-[60] overflow-hidden",
                                            isMobile
                                                ? "fixed inset-0 w-full transition-transform duration-300"
                                                : "shrink-0 transition-[width] duration-300 ease-in-out",
                                            isMobile
                                                ? (isQaListOpen ? "translate-x-0" : "translate-x-full")
                                                : (isQaListOpen ? "w-80" : "w-0")
                                        )}
                                    >
                                        <div className={cn("h-full", isMobile ? "w-full" : "w-80")}>
                                            <QaList
                                                onClose={toggleQaList}
                                                onAsk={handleQaAsk}
                                            />
                                        </div>
                                    </div>

                                    <AiChatModal
                                        isOpen={globalAiChat.isOpen}
                                        onClose={() => setGlobalAiChat(prev => ({ ...prev, isOpen: false }))}
                                        initialInput={globalAiChat.initialInput}
                                        autoSubmit={true}
                                        onInsertText={(text) => {
                                            window.dispatchEvent(new CustomEvent("editor:insert-text", { detail: text }));
                                        }}
                                    />
                                </div>
                            </div>
                        </Panel>
                    )}

                    {isCanvasOpen && !isCanvasFullscreen && (
                        <Separator className={cn(
                            "bg-transparent hover:bg-primary/10 transition-colors flex items-center justify-center group/handle z-50 outline-none relative",
                            isMobile
                                ? "h-2 w-full cursor-row-resize -mt-[4px] -mb-[4px]"
                                : "w-2 h-full cursor-col-resize -ml-[4px] -mr-[4px]"
                        )}>
                            <div className={cn(
                                "bg-border/40 group-hover/handle:bg-primary/50 transition-all shadow-[0_0_10px_rgba(0,0,0,0.05)]",
                                isMobile ? "h-[1px] w-full" : "w-[1px] h-full"
                            )} />
                            <div className={cn(
                                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-muted-foreground/20 rounded-full group-hover/handle:bg-primary/40 transition-colors opacity-0 group-hover/handle:opacity-100",
                                isMobile ? "w-8 h-1" : "w-1 h-8"
                            )} />
                        </Separator>
                    )}

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
        </div>
    );
};

export const DocumentEditorLayout = memo(DocumentEditorLayoutComponent, (prev, next) => {
    const idMatch = prev.documentId === next.documentId;
    const coverMatch = prev.document?.coverImage === next.document?.coverImage;
    const archiveMatch = prev.document?.isArchived === next.document?.isArchived;
    const iconMatch = prev.document?.icon === next.document?.icon;

    return idMatch && coverMatch && archiveMatch && iconMatch;
});
