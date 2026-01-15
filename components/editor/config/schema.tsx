"use client";

import {
    defaultBlockSpecs,
    defaultProps,
    BlockNoteSchema,
    defaultStyleSpecs,
} from "@blocknote/core";
import { createReactBlockSpec, createReactStyleSpec } from "@blocknote/react";
import { useTheme } from "next-themes";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Zap, FileIcon } from "lucide-react";
import { toast } from "sonner";
import { createManualAnchor } from "@/actions/anchors";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { getById } from "@/actions/documents";
import { useNavigationStore } from "@/store/use-navigation-store";

// Dynamic import for Excalidraw
const Excalidraw = dynamic(
    () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
    { ssr: false }
);

/**
 * Excalidraw Block
 */
export const ExcalidrawBlock = createReactBlockSpec(
    {
        type: "excalidraw",
        propSchema: {
            backgroundColor: { default: "default" },
            textColor: { default: "default" },
            textAlignment: { default: "left", values: ["left", "center", "right", "justify"] as const },
            data: { default: "[]" },
        },
        content: "none",
    },
    {
        render: ({ block, editor }) => {
            const { resolvedTheme } = useTheme();
            const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

            const handleChange = (elements: any) => {
                editor.updateBlock(block, {
                    type: "excalidraw",
                    props: { data: JSON.stringify(elements) },
                });
            };

            const handleCaptureSemantic = async () => {
                if (!excalidrawAPI) return;
                const selectedElements = excalidrawAPI.getSelectedElements();
                const textElements = selectedElements.filter((el: any) => el.type === "text");

                if (textElements.length === 0) {
                    toast.error("Please select a text element on the canvas first");
                    return;
                }

                const keyword = textElements[0].text;
                const nodeId = textElements[0].id;

                toast.loading(`Capturing "${keyword}"...`, { id: "excalidraw-sync" });

                try {
                    const res = await createManualAnchor({
                        blockId: block.id,
                        documentId: (editor as any)._documentId || "",
                        userId: (editor as any)._userId || "",
                        title: keyword,
                        type: "concept",
                        startOffset: 0,
                        endOffset: keyword.length,
                        blockText: "[Canvas Content]",
                        blockType: "excalidraw",
                        metadata: {
                            source: "excalidraw",
                            elementId: nodeId,
                            capturedAt: new Date().toISOString(),
                            documentId: (editor as any)._documentId
                        }
                    });

                    if (res.success) {
                        toast.success(`Concept "${keyword}" unified`, { id: "excalidraw-sync" });
                    }
                } catch (error) {
                    toast.error("Capture failed", { id: "excalidraw-sync" });
                }
            };

            return (
                <div className="relative w-full h-[500px] border border-white/5 rounded-xl overflow-hidden group/canvas bg-background shadow-inner">
                    <div className="absolute top-2 right-2 z-50 flex gap-2 opacity-0 group-hover/canvas:opacity-100 transition-opacity">
                        <button
                            onClick={handleCaptureSemantic}
                            className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/30 rounded-lg backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-purple-200 transition-all"
                        >
                            <Zap className="w-3 h-3 fill-current" />
                            Mark Concept
                        </button>
                    </div>

                    <Excalidraw
                        excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
                        initialData={{
                            elements: JSON.parse(block.props.data || "[]"),
                            appState: { theme: resolvedTheme === "dark" ? "dark" : "light" }
                        }}
                        onChange={handleChange}
                        theme={resolvedTheme === "dark" ? "dark" : "light"}
                    />
                </div>
            );
        },
    }
);

/**
 * Page Block
 */
export const PageBlock = createReactBlockSpec(
    {
        type: "page",
        propSchema: {
            pageId: { default: "" },
            title: { default: "Untitled" },
        },
        content: "none",
    },
    {
        render: ({ block }) => {
            const router = useRouter();
            const { data: pageData } = useSWR(
                block.props.pageId ? `page-${block.props.pageId}` : null,
                () => getById(block.props.pageId)
            );

            const title = pageData?.title || block.props.title || "Untitled";

            return (
                <div
                    onClick={() => router.push(`/documents/${block.props.pageId}`)}
                    className="flex items-center gap-x-3 w-full p-2.5 my-1 rounded-xl bg-muted/30 hover:bg-muted/60 dark:bg-white/5 dark:hover:bg-white/10 cursor-pointer group transition-all border border-border/20 hover:border-border/60 hover:shadow-sm"
                >
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-background border border-border/40 shadow-sm group-hover:scale-110 transition-transform">
                        {pageData?.icon ? (
                            <span className="text-lg">{pageData.icon}</span>
                        ) : (
                            <FileIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        )}
                    </div>
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                        <span className="font-semibold text-sm text-foreground/90 group-hover:text-foreground transition-colors truncate">
                            {title}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-tight">
                            Sub-Page
                        </span>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <Zap className="h-3 w-3 text-purple-500/50" />
                        <div className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold">OPEN</div>
                    </div>
                </div>
            );
        },
    }
);

// Semantic Style
export const SemanticStyle = createReactStyleSpec(
    {
        type: "semantic",
        propSchema: "string",
    },
    {
        render: ({ value, children, contentRef }: any) => {
            let data = { anchorId: "", nodeId: "", provenance: "AI", isLocked: "false" };
            try {
                if (value) data = JSON.parse(value);
            } catch (e) { }

            const isLocked = data.isLocked === "true";
            const isAi = data.provenance === "AI";
            const isRejected = data.provenance === "USER_REJECTED";

            let className = "px-0.5 rounded-sm transition-all duration-300 ";

            if (isLocked && !isRejected) {
                className += "bg-purple-500/10 border-b-2 border-purple-500/50 shadow-[0_2px_4px_rgba(168,85,247,0.1)]";
            } else if (isRejected) {
                className += "bg-rose-500/10 border-b-2 border-rose-500/30 line-through decoration-rose-500/50";
            } else if (isAi) {
                className += "bg-amber-500/5 border-b-2 border-dashed border-amber-500/40 hover:bg-amber-500/10 animate-pulse";
            }

            return (
                <span
                    ref={contentRef}
                    className={className}
                    data-anchor-id={data.anchorId}
                    data-node-id={data.nodeId}
                    data-is-locked={data.isLocked}
                >
                    {children}
                </span>
            );
        },
    }
);

// Canvas Link Style
export const CanvasLinkStyle = createReactStyleSpec(
    {
        type: "canvasLink",
        propSchema: "string", // value = elementId
        content: "styled",
    },
    {
        render: (props: any) => {
            return (
                <span
                    className="canvas-bound-text cursor-pointer transition-colors rounded-sm px-0.5"
                    style={{
                        color: '#ea580c', // orange-600
                        backgroundColor: '#fee2e2', // red-100
                        borderBottom: '1px solid #fed7aa', // orange-200
                    }}
                    data-canvas-link={props.value}
                    ref={props.contentRef}
                    onClick={(e) => {
                        e.stopPropagation();
                        useNavigationStore.getState().jumpToElement(props.value);
                    }}
                >
                    {props.children}
                </span>
            );
        },
    }
);

// Schema creation
export const schema = BlockNoteSchema.create({
    blockSpecs: {
        ...defaultBlockSpecs,
        excalidraw: ExcalidrawBlock(),
        page: PageBlock(),
    },
    styleSpecs: {
        ...defaultStyleSpecs,
        semantic: SemanticStyle,
        canvasLink: CanvasLinkStyle,
    },
});
