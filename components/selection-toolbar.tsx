/**
 * Selection Toolbar Component
 *
 * Unified toolbar that appears when text is selected
 * Includes: Drag to Canvas, AI Assistant, Generate Chart, Link Existing
 */

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Move, Sparkles, PieChart, Link, X, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { dragDropBridge } from "@/lib/canvas/drag-drop-bridge";
import { DRAG_MIME_TYPE, DragSourceType } from "@/lib/canvas/drag-drop-types";
import { AiChatModal } from "./ai-chat-modal";

interface SelectionToolbarProps {
    documentId: string;
    onCreateConcept?: (text: string) => void;
    onGenerateChart?: (text: string, position: { top: number; left: number }) => void;
    onLinkExisting?: (text: string) => void;
    onEnsureCanvas?: () => void;
    // New props for loading state
    status?: "idle" | "loading" | "review" | "success" | "error";
    statusMessage?: string;
    chartMetadata?: { nodeCount: number };
    onConfirmInsert?: () => void;
    onCancel?: () => void;
}

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
    documentId,
    onCreateConcept,
    onGenerateChart,
    onLinkExisting,
    onEnsureCanvas,
    status = "idle",
    statusMessage = "",
    chartMetadata,
    onConfirmInsert,
    onCancel,
}) => {
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [selectedText, setSelectedText] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const [showAiChat, setShowAiChat] = useState(false);
    // New state for editing before adding to Q&A
    const [isAddingQa, setIsAddingQa] = useState(false);
    const [qaInput, setQaInput] = useState("");
    const qaInputRef = useRef<HTMLInputElement>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Listen for selection changes
    useEffect(() => {
        const handleSelectionChange = () => {
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }

            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) {
                hideTimeoutRef.current = setTimeout(() => {
                    if (!showAiChat && !isAddingQa) { // Prevent hiding if adding QA
                        setVisible(false);
                        setIsAddingQa(false); // Reset QA mode
                    }
                }, 300);
                return;
            }

            const text = selection.toString().trim();

            if (text.length > 0) {
                setSelectedText(text);

                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();

                // Position toolbar below the selection
                setPosition({
                    x: rect.left + rect.width / 2,
                    y: rect.bottom + 8,
                });

                setVisible(true);
            } else {
                hideTimeoutRef.current = setTimeout(() => {
                    if (!showAiChat && !isAddingQa) { // Prevent hiding if adding QA
                        setVisible(false);
                        setIsAddingQa(false); // Reset QA mode
                    }
                }, 300);
            }
        };

        document.addEventListener("selectionchange", handleSelectionChange);

        return () => {
            document.removeEventListener("selectionchange", handleSelectionChange);
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
        };
    }, [showAiChat, isAddingQa]);

    // 【企业级】监听拖拽绑定成功事件，自动隐藏Toolbar
    useEffect(() => {
        const handleBindingSuccess = (e: CustomEvent) => {
            const { elementId, blockId } = e.detail;

            console.log('[SelectionToolbar] Binding created successfully, hiding toolbar', { elementId, blockId });

            // 拖拽成功后立即隐藏Toolbar
            setVisible(false);
            setIsAddingQa(false);
            setSelectedText('');
            setIsDragging(false);

            // 清除hideTimeout
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
                hideTimeoutRef.current = null;
            }
        };

        window.addEventListener('document:canvas-binding-success', handleBindingSuccess as EventListener);
        return () => window.removeEventListener('document:canvas-binding-success', handleBindingSuccess as EventListener);
    }, []);

    const handleDragStart = (e: React.DragEvent) => {
        setIsDragging(true);
        // Ensure canvas is open so user can drop onto it
        onEnsureCanvas?.();

        let blockId: string | undefined;
        let sourceType: DragSourceType = "text";

        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer;
            const element = container.nodeType === 3 ? container.parentElement : container as HTMLElement;

            const blockElement = element?.closest("[data-node-type], [data-id]");
            if (blockElement) {
                blockId = blockElement.getAttribute("data-id") || undefined;
                const nodeType = blockElement.getAttribute("data-node-type");

                if (nodeType?.includes("heading")) {
                    sourceType = "heading";
                } else if (nodeType === "code") {
                    sourceType = "code";
                } else if (nodeType === "listItem") {
                    sourceType = "list-item";
                }
            }
        }

        const payload = dragDropBridge.createDragPayload({
            text: selectedText,
            documentId,
            blockId,
            sourceType,
            metadata: {
                selectionLength: selectedText.length,
                draggedFromToolbar: true,
                startOffset: window.getSelection()?.getRangeAt(0).startOffset,
                endOffset: window.getSelection()?.getRangeAt(0).endOffset
            },
            // Critical: Pass exact selection info for robust optimistic binding styles
            selectionInfo: blockId ? {
                blockId,
                selectedText,
                timestamp: Date.now()
            } : undefined
        });

        e.dataTransfer.setData(DRAG_MIME_TYPE, dragDropBridge.serializeDragPayload(payload));
        e.dataTransfer.setData("text/plain", selectedText);
        e.dataTransfer.effectAllowed = "copy";

        const dragImage = createDragImage(selectedText, sourceType);
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 140, 30);

        setTimeout(() => {
            if (document.body.contains(dragImage)) {
                document.body.removeChild(dragImage);
            }
        }, 0);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    const handleAiClick = () => {
        setShowAiChat(true);
    };

    const handleCloseAiChat = () => {
        setShowAiChat(false);
    };

    const handleGenerateChart = () => {
        console.log('[SelectionToolbar] Generate Chart clicked', { selectedText, position });
        onGenerateChart?.(selectedText, { top: position.y + 60, left: position.x });
        setVisible(false);
    };

    const handleLinkExisting = () => {
        onLinkExisting?.(selectedText);
        setVisible(false);
    };

    const showToolbar = visible;
    const showStatus = status !== "idle";

    if (!showToolbar && !showStatus && !showAiChat) return null;

    // Handle adding directly
    const handleAddQa = () => {
        if (!qaInput.trim()) return;

        import("@/store/use-qa-store").then(({ useQaStore }) => {
            useQaStore.getState().addItem(qaInput);
            import("sonner").then(({ toast }) => toast.success("Added to Q&A List"));
            setVisible(false);
            setIsAddingQa(false);
        });
    };

    return (
        <>
            {/* Toolbar Buttons */}
            {showToolbar && (
                <div
                    ref={toolbarRef}
                    className="fixed z-[9999] pointer-events-auto animate-spring-enter"
                    style={{
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                    }}
                >
                    <div
                        className={cn(
                            "flex items-center px-2 py-1.5 rounded-xl shadow-2xl",
                            "bg-gradient-to-r from-orange-500 to-red-500",
                            isDragging && "opacity-50"
                        )}
                    >
                        {/* Drag to Canvas Button */}
                        <button
                            draggable
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-colors cursor-grab active:cursor-grabbing"
                            title="拖拽到画布"
                        >
                            <Move className="w-4 h-4" />
                            <span className="text-xs font-medium hidden sm:inline">画布</span>
                        </button>

                        {/* Divider */}
                        <div className="w-px h-5 bg-white/20" />

                        {/* AI Assistant Button */}
                        <button
                            onClick={handleAiClick}
                            className="flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-colors"
                            title="AI 助手"
                        >
                            <Sparkles className="w-4 h-4" />
                            <span className="text-xs font-medium hidden sm:inline">AI</span>
                        </button>

                        {/* Divider */}
                        <div className="w-px h-5 bg-white/20" />

                        {/* Generate Chart Button */}
                        <button
                            onClick={handleGenerateChart}
                            className="flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-colors"
                            title="生成图表"
                        >
                            <PieChart className="w-4 h-4" />
                            <span className="text-xs font-medium hidden sm:inline">图表</span>
                        </button>



                        {/* Divider */}
                        <div className="w-px h-5 bg-white/20" />

                        {/* Ask Later Button */}
                        <button
                            onClick={() => {
                                setIsAddingQa(true);
                                setQaInput(selectedText);
                                // Focus handled by autoFocus on input render
                            }}
                            className="flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-colors"
                            title="待问清单"
                        >
                            <HelpCircle className="w-4 h-4" />
                            <span className="text-xs font-medium hidden sm:inline">待问</span>
                        </button>
                    </div>

                    {/* QA Input Mode */}
                    {isAddingQa && (
                        <div
                            className={cn(
                                "absolute left-0 bottom-full mb-2 w-64 bg-background/90 backdrop-blur-md rounded-lg shadow-xl border border-border/50 p-2 animate-in fade-in zoom-in-95 origin-bottom",
                                "flex flex-col gap-2"
                            )}
                            style={{
                                transform: "translateX(calc(50% - 128px))" // Center relative to toolbar center (toolbar is absolute positioned)
                            }}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">Add to Q&A</span>
                                <button onClick={() => setIsAddingQa(false)} className="text-muted-foreground hover:text-foreground">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                            <textarea
                                value={qaInput}
                                onChange={(e) => setQaInput(e.target.value)}
                                ref={(input) => {
                                    if (input) {
                                        input.focus();
                                        input.setSelectionRange(input.value.length, input.value.length);
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleAddQa();
                                    }
                                }}
                                className="text-xs bg-muted/50 border border-border/30 rounded p-1.5 min-h-[60px] resize-none focus:outline-none focus:ring-1 focus:ring-orange-500"
                                placeholder="Edit question..."
                            />
                            <button
                                onClick={handleAddQa}
                                className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium py-1 rounded transition-colors"
                            >
                                Confirm Add
                            </button>
                        </div>
                    )}

                    {/* Arrow pointing up to selection */}

                    {/* Arrow pointing up to selection */}
                    <div className="absolute left-1/2 -top-2 -translate-x-1/2">
                        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-orange-500" />
                    </div>
                </div>
            )}

            {/* Independent Status Window */}
            {showStatus && (
                <div
                    className="fixed z-[10000] pointer-events-auto"
                    style={{
                        left: `${position.x}px`,
                        top: `${position.y + (showToolbar ? 50 : 0)}px`,
                        transform: "translateX(-50%)"
                    }}
                >
                    <div className="bg-background/80 backdrop-blur-md rounded-lg shadow-xl border border-border/50 p-2.5 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 min-w-[200px]">
                        <div className="flex items-center gap-2">
                            {status === "loading" && <Sparkles className="w-3.5 h-3.5 text-orange-500 animate-pulse" />}
                            {status === "success" && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                            {(status === "error") && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                            {status === "review" && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}

                            <span className="text-xs font-medium text-foreground/80">
                                {status === "loading" ? "AI 正在思考..." :
                                    status === "success" ? "生成完成" :
                                        status === "review" ? "生成预览" : "生成失败"}
                            </span>
                        </div>

                        {statusMessage && (
                            <div className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-1 rounded font-mono break-all max-h-[60px] overflow-hidden">
                                {statusMessage}
                            </div>
                        )}

                        {status === "review" && chartMetadata && (
                            <div className="mt-1 flex flex-col gap-2">
                                <div className="text-[10px] text-muted-foreground">
                                    检测到 {chartMetadata.nodeCount} 个节点
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={onCancel}
                                        className="flex-1 px-2 py-1 text-[10px] bg-muted hover:bg-muted/80 rounded transition-colors"
                                    >
                                        取消
                                    </button>
                                    <button
                                        onClick={onConfirmInsert}
                                        className="flex-1 px-2 py-1 text-[10px] bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 rounded font-medium transition-colors"
                                    >
                                        插入图表
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Arrow if toolbar is hidden */}
                    {!showToolbar && (
                        <div className="absolute left-1/2 -top-2 -translate-x-1/2">
                            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-background/80" />
                        </div>
                    )}
                </div>
            )}

            {/* AI Chat Modal */}
            <AiChatModal
                isOpen={showAiChat}
                onClose={handleCloseAiChat}
                initialInput={selectedText}
                position={visible ? { top: position.y + 60, left: position.x } : undefined}
            />
        </>
    );
};

/**
 * Create drag preview
 */
function createDragImage(text: string, sourceType: DragSourceType): HTMLElement {
    const preview = document.createElement("div");
    const displayText = text.length > 60 ? text.substring(0, 60) + "..." : text;

    preview.style.cssText = `
    position: fixed;
    top: -1000px;
    left: -1000px;
    width: 280px;
    padding: 12px 16px;
    background: linear-gradient(135deg, #f97316, #ef4444);
    color: white;
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
  `;

    preview.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 18px;">📝</span>
      <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${displayText}</span>
    </div>
    <div style="margin-top: 8px; font-size: 10px; opacity: 0.8; text-align: center;">
      拖拽到画布创建元素
    </div>
  `;

    return preview;
}
