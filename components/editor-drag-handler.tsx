/**
 * Editor Drag Handler
 *
 * Enables dragging selected text to canvas with Shift key
 * Usage: Wrap the editor component with this handler
 */

"use client";

import { useEffect, useRef, ReactNode } from "react";
import { dragDropBridge } from "@/lib/canvas/drag-drop-bridge";
import { DRAG_MIME_TYPE, DragSourceType } from "@/lib/canvas/drag-drop-types";

interface EditorDragHandlerProps {
  children: ReactNode;
  documentId: string;
  enabled?: boolean;
}

export const EditorDragHandler: React.FC<EditorDragHandlerProps> = ({
  children,
  documentId,
  enabled = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;

    const handleMouseDown = (e: MouseEvent) => {
      // Only handle with Shift key
      if (!e.shiftKey) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const selectedText = selection.toString().trim();
      if (!selectedText || selectedText.length === 0) return;

      // Check if click is within selected text
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        isDraggingRef.current = true;

        // Change cursor
        document.body.style.cursor = "grabbing";

        // Prevent default text selection behavior
        e.preventDefault();
      }
    };

    const handleDragStart = (e: DragEvent) => {
      if (!isDraggingRef.current) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const selectedText = selection.toString().trim();
      if (!selectedText) {
        e.preventDefault();
        return;
      }

      // Find the block ID from the DOM
      let blockId: string | undefined;
      let blockType = "paragraph";

      const target = e.target as HTMLElement;
      const blockElement = target.closest("[data-id]");

      if (blockElement) {
        blockId = blockElement.getAttribute("data-id") || undefined;
        blockType = blockElement.getAttribute("data-node-type") || "paragraph";
      }

      // 【即时标记】保存选区范围信息，用于放下后恢复
      // 保存选区的 DOM 上下文信息
      const range = selection.getRangeAt(0);
      const selectionInfo = {
        blockId,
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        selectedText,
        timestamp: Date.now()
      };

      // 存储到 sessionStorage，确保跨组件可访问
      sessionStorage.setItem('pendingDragSelection', JSON.stringify(selectionInfo));
      console.log("[EditorDragHandler] Saved selection info:", selectionInfo);

      // Determine source type based on block type or selection context
      let sourceType: DragSourceType = "text";

      if (blockType.includes("heading")) {
        sourceType = "heading";
      } else if (blockType === "code") {
        sourceType = "code";
      } else if (blockId) {
        sourceType = "block";
      }

      // Create drag payload
      const payload = dragDropBridge.createDragPayload({
        text: selectedText,
        documentId,
        blockId,
        sourceType,
        metadata: {
          selectionLength: selectedText.length,
          blockType,
          // 包含选区信息用于即时标记
          selectionInfo: selectionInfo
        },
      });

      // Set drag data and image
      if (e.dataTransfer) {
        e.dataTransfer.setData(DRAG_MIME_TYPE, dragDropBridge.serializeDragPayload(payload));
        e.dataTransfer.setData("text/plain", selectedText);
        e.dataTransfer.effectAllowed = "copy";

        // Create custom drag image
        const dragImage = createDragImage(selectedText, sourceType);
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 0, 0);

        // Remove drag image after a short delay
        setTimeout(() => {
          if (document.body.contains(dragImage)) {
            document.body.removeChild(dragImage);
          }
        }, 0);
      }

      console.log("[EditorDragHandler] Drag started:", { selectedText, blockId, sourceType });
    };

    const handleDragEnd = (e: DragEvent) => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      console.log("[EditorDragHandler] Drag ended");
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = "";
      }
    };

    // Add event listeners
    container.addEventListener("mousedown", handleMouseDown);
    container.addEventListener("dragstart", handleDragStart as any);
    container.addEventListener("dragend", handleDragEnd as any);
    container.addEventListener("mouseup", handleMouseUp);

    // Make text selectable and draggable when Shift is held
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
          // Make selection draggable
          const range = selection.getRangeAt(0);
          const selectedElements = container.querySelectorAll(".ProseMirror *");

          selectedElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            if (range.intersectsNode(el)) {
              htmlEl.draggable = true;
            }
          });
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        // Remove draggable attribute
        const draggableElements = container.querySelectorAll("[draggable='true']");
        draggableElements.forEach((el) => {
          (el as HTMLElement).draggable = false;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      container.removeEventListener("dragstart", handleDragStart as any);
      container.removeEventListener("dragend", handleDragEnd as any);
      container.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [documentId, enabled]);

  return (
    <div ref={containerRef} className="relative">
      {children}
    </div>
  );
};

/**
 * Create a custom drag image for visual feedback
 */
function createDragImage(text: string, sourceType: string): HTMLElement {
  const dragImage = document.createElement("div");

  // Truncate long text
  const displayText = text.length > 60 ? text.substring(0, 60) + "..." : text;

  // Style based on source type
  let bgColor = "from-orange-500 to-red-500";
  let icon = "📝";

  if (sourceType === "heading") {
    bgColor = "from-amber-500 to-orange-500";
    icon = "#️⃣";
  } else if (sourceType === "code") {
    bgColor = "from-gray-700 to-gray-900";
    icon = "💻";
  } else if (sourceType === "block") {
    bgColor = "from-indigo-500 to-purple-500";
    icon = "🧱";
  }

  dragImage.innerHTML = `
    <div style="
      position: fixed;
      top: -1000px;
      left: -1000px;
      padding: 12px 16px;
      background: linear-gradient(135deg, ${bgColor.split(' ')[1]}, ${bgColor.split(' ')[2]});
      color: white;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      font-size: 14px;
      font-weight: 500;
      max-width: 300px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: flex;
      align-items: center;
      gap: 8px;
    ">
      <span style="font-size: 18px;">${icon}</span>
      <span>${displayText}</span>
    </div>
  `;

  return dragImage;
}
