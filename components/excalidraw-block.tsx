"use client";

import { useEffect, useState } from "react";
import { createBlockSpec } from "@blocknote/core";
import { defaultProps } from "@blocknote/core";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import { Loader2, Zap } from "lucide-react";
import { createManualAnchor } from "@/actions/anchors";
import { toast } from "sonner";

// Dynamic import for Excalidraw
const Excalidraw = dynamic(
    () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
    { ssr: false }
);

/**
 * Excalidraw 语义化方块
 * 允许用户绘图，并能将选中的文本元素转化为“语义节点”
 */
export const ExcalidrawBlock = createBlockSpec(
    {
        type: "excalidraw",
        propSpecs: {
            ...defaultProps,
            data: { default: "[]" }, // 存储 Excalidraw 元素 JSON
        },
        content: "none",
    },
    {
        render: (props: any) => {
            const { resolvedTheme } = useTheme();
            const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

            // 保存数据到 BlockNote
            const handleChange = (elements: any) => {
                props.editor.updateBlock(props.block, {
                    type: "excalidraw",
                    props: { data: JSON.stringify(elements) },
                });
            };

            // 提取语义：将选中的文字转化为节点
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

                toast.loading(`Capturing "${keyword}" as concept...`, { id: "excalidraw-sync" });

                try {
                    // 调用现有的原子化创建逻辑
                    // 注意：此处 anchor 绑定在当前的 excalidraw block 上
                    const res = await createManualAnchor({
                        blockId: props.block.id,
                        documentId: (props.editor as any)._documentId || "", // 假设我们能拿到 documentId
                        userId: (props.editor as any)._userId || "",
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
                            documentId: (props.editor as any)._documentId
                        }
                    });

                    if (res.success) {
                        toast.success(`Concept "${keyword}" unified to collective intelligence`, { id: "excalidraw-sync" });
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
                            title="Convert text element to Semantic Node"
                        >
                            <Zap className="w-3 h-3 fill-current" />
                            Mark Concept
                        </button>
                    </div>

                    <Excalidraw
                        excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
                        initialData={{
                            elements: JSON.parse(props.block.props.data || "[]"),
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
