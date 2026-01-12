"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { useSemanticSync } from "@/store/use-semantic-sync";
import { getSemanticGraphData } from "@/actions/graph";
import { Loader2, Share2, Target } from "lucide-react";
import { useTheme } from "next-themes";

interface SemanticGraphPanelProps {
    documentId: string;
}

export const SemanticGraphPanel = ({ documentId }: SemanticGraphPanelProps) => {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";

    const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
    const [data, setData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
    const [isLoading, setIsLoading] = useState(true);

    const { activeNodeId, setActiveNode } = useSemanticSync();

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const graphData = await getSemanticGraphData(documentId);
            setData(graphData);
            setIsLoading(false);
        };

        fetchData();
        // 监听文档更新（可选：可以配合事件或 SWR 刷新）
    }, [documentId]);

    // 当外部（文档）激活某个节点时，图中高亮并居中
    useEffect(() => {
        if (activeNodeId && fgRef.current) {
            const node = data.nodes.find(n => n.id === activeNodeId);
            if (node) {
                fgRef.current.centerAt(node.x, node.y, 400);
                fgRef.current.zoom(2.5, 400);
            }
        }
    }, [activeNodeId, data.nodes]);

    const graphContent = useMemo(() => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground animate-in fade-in duration-500">
                    <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
                    <span className="text-xs uppercase tracking-widest font-bold">Resonating Graph...</span>
                </div>
            );
        }

        if (data.nodes.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4 text-muted-foreground">
                    <Share2 className="w-10 h-10 stroke-[1.5] opacity-20" />
                    <div className="space-y-1">
                        <p className="text-sm font-medium">Clear Canvas</p>
                        <p className="text-[10px] leading-relaxed opacity-60">
                            No semantic entities captured yet.<br />
                            Mark concepts in the document to begin projection.
                        </p>
                    </div>
                </div>
            );
        }

        return (
            <ForceGraph2D
                ref={fgRef}
                graphData={data}
                nodeLabel="title"
                nodeAutoColorBy="type"
                nodeRelSize={6}
                linkDirectionalParticles={2}
                linkDirectionalParticleSpeed={0.005}
                linkColor={() => isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}
                backgroundColor="transparent"
                onNodeClick={(node: any) => {
                    setActiveNode(node.id);
                    // 触发文档跳转逻辑（通过聚焦 anchor）
                    console.log(`[GraphPanel] Node clicked: ${node.title} (${node.id})`);
                }}
                nodeCanvasObject={(node: any, ctx, globalScale) => {
                    const label = node.title;
                    const fontSize = 12 / globalScale;
                    ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
                    const textWidth = ctx.measureText(label).width;
                    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

                    // 绘制发光背景
                    const isActive = node.id === activeNodeId;

                    ctx.beginPath();
                    ctx.arc(node.x, node.y, 4, 0, 2 * Math.PI, false);
                    ctx.fillStyle = isActive ? "#a855f7" : (isDark ? "#555" : "#ccc");
                    ctx.fill();

                    if (isActive) {
                        ctx.shadowColor = "#a855f7";
                        ctx.shadowBlur = 15;
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI, false);
                        ctx.strokeStyle = "rgba(168, 85, 247, 0.5)";
                        ctx.stroke();
                        ctx.shadowBlur = 0;
                    }

                    // 只有缩放到一定程度才显示文字
                    if (globalScale > 1.5) {
                        ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.6)" : "rgba(0, 0, 0, 0.6)";
                        ctx.fillText(label, node.x + 8, node.y + fontSize / 2);
                    }
                }}
            />
        );
    }, [data, isLoading, activeNodeId, setActiveNode]);

    return (
        <div className="h-full w-full relative group/graph overflow-hidden bg-background/5 border-l border-white/5 backdrop-blur-sm shadow-2xl">
            {/* 装饰性背景 */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.03)_0%,transparent_70%)] pointer-events-none" />

            {/* 头部面板 */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 pointer-events-none">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                    <span className="text-[10px] uppercase font-black tracking-[0.2em] text-foreground/40">
                        Semantic Projection
                    </span>
                </div>
                <button
                    onClick={() => fgRef.current?.zoomToFit(400)}
                    className="p-1.5 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 transition-all pointer-events-auto"
                    title="Recenter"
                >
                    <Target className="w-3 h-3 text-white/50" />
                </button>
            </div>

            <div className="w-full h-full">
                {graphContent}
            </div>

            {/* 侧边图例 */}
            <div className="absolute bottom-4 left-4 p-3 rounded-xl bg-background/40 border border-white/5 backdrop-blur-md z-10 pointer-events-none">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span className="text-[9px] text-foreground/40 uppercase font-bold">Concepts</span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-foreground/20 italic">
                        <span>Co-occurrence link</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
