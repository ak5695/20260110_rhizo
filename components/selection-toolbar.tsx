/**
 * Selection Toolbar Component
 *
 * Unified toolbar that appears when text is selected
 * Includes: Drag to Canvas, AI Assistant, Create Concept, Link Existing
 */

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Move, Sparkles, PlusCircle, Link, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { dragDropBridge } from "@/lib/canvas/drag-drop-bridge";
import { DRAG_MIME_TYPE, DragSourceType } from "@/lib/canvas/drag-drop-types";
import { AiChatModal } from "./ai-chat-modal";

interface SelectionToolbarProps {
    documentId: string;
    onCreateConcept?: (text: string) => void;
    onLinkExisting?: (text: string) => void;
    onEnsureCanvas?: () => void;
}

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
    documentId,
    onCreateConcept,
    onLinkExisting,
    onEnsureCanvas,
}) => {
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [selectedText, setSelectedText] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const [showAiChat, setShowAiChat] = useState(false);
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
                    if (!showAiChat) {
                        setVisible(false);
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
                    if (!showAiChat) {
                        setVisible(false);
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
    }, [showAiChat]);

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
            },
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

    const handleCreateConcept = () => {
        onCreateConcept?.(selectedText);
        setVisible(false);
    };

    const handleLinkExisting = () => {
        onLinkExisting?.(selectedText);
        setVisible(false);
    };

    if (!visible && !showAiChat) return null;

    return (
        <>
            {/* Selection Toolbar */}
            {visible && (
                <div
                    ref={toolbarRef}
                    className="fixed z-[9999] pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
                    style={{
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                        transform: "translateX(-50%)",
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

                        {/* Create Concept Button */}
                        <button
                            onClick={handleCreateConcept}
                            className="flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-colors"
                            title="创建概念"
                        >
                            <PlusCircle className="w-4 h-4" />
                            <span className="text-xs font-medium hidden sm:inline">概念</span>
                        </button>

                        {/* Link Existing Button */}
                        <button
                            onClick={handleLinkExisting}
                            className="flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-colors"
                            title="关联已有"
                        >
                            <Link className="w-4 h-4" />
                            <span className="text-xs font-medium hidden sm:inline">关联</span>
                        </button>
                    </div>

                    {/* Arrow pointing up to selection */}
                    <div className="absolute left-1/2 -top-2 -translate-x-1/2">
                        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-orange-500" />
                    </div>
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

export default SelectionToolbar;
