/**
 * Use Text Drag Hook
 *
 * Enables dragging selected text to canvas with Shift key
 * Usage: Call this hook in your editor component
 */

"use client";

import { useEffect } from "react";
import { dragDropBridge } from "@/lib/canvas/drag-drop-bridge";
import { DRAG_MIME_TYPE, DragSourceType } from "@/lib/canvas/drag-drop-types";

interface UseTextDragOptions {
  documentId: string;
  enabled?: boolean;
  containerSelector?: string;
}

export function useTextDrag({
  documentId,
  enabled = true,
  containerSelector = ".bn-container",
}: UseTextDragOptions) {
  useEffect(() => {
    if (!enabled) return;

    let isShiftPressed = false;
    let dragStarted = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        isShiftPressed = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        isShiftPressed = false;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Only enable drag when Shift is pressed
      if (!isShiftPressed) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const selectedText = selection.toString().trim();
      if (!selectedText) return;

      // Check if we're clicking within the selection
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        dragStarted = true;

        // Make the selection draggable
        const container = document.querySelector(containerSelector);
        if (container) {
          container.setAttribute("draggable", "true");
        }

        // Change cursor
        document.body.style.cursor = "grab";
      }
    };

    const handleDragStart = (e: DragEvent) => {
      if (!dragStarted || !isShiftPressed) {
        e.preventDefault();
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        e.preventDefault();
        return;
      }

      const selectedText = selection.toString().trim();
      if (!selectedText) {
        e.preventDefault();
        return;
      }

      // Find block context
      let blockId: string | undefined;
      let sourceType: DragSourceType = "text";

      const target = e.target as HTMLElement;

      // Try to find BlockNote block element
      const blockElement = target.closest("[data-node-type], [data-id]");

      if (blockElement) {
        blockId = blockElement.getAttribute("data-id") || undefined;
        const nodeType = blockElement.getAttribute("data-node-type");

        // Determine source type from block
        if (nodeType?.includes("heading")) {
          sourceType = "heading";
        } else if (nodeType === "code") {
          sourceType = "code";
        } else if (nodeType === "paragraph") {
          sourceType = "paragraph";
        }
      }

      // Create drag payload
      const payload = dragDropBridge.createDragPayload({
        text: selectedText,
        documentId,
        blockId,
        sourceType,
        metadata: {
          selectionLength: selectedText.length,
          timestamp: Date.now(),
        },
      });

      // Set drag data
      if (e.dataTransfer) {
        e.dataTransfer.setData(DRAG_MIME_TYPE, dragDropBridge.serializeDragPayload(payload));
        e.dataTransfer.setData("text/plain", selectedText);
        e.dataTransfer.effectAllowed = "copy";

        // Create custom drag image
        const dragImage = createDragPreview(selectedText, sourceType);
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 150, 30);

        // Clean up drag image after short delay
        setTimeout(() => {
          if (document.body.contains(dragImage)) {
            document.body.removeChild(dragImage);
          }
        }, 0);
      }

      document.body.style.cursor = "grabbing";

      console.log("[useTextDrag] Drag started:", {
        text: selectedText.substring(0, 50) + "...",
        sourceType,
        blockId,
      });
    };

    const handleDragEnd = (e: DragEvent) => {
      dragStarted = false;
      document.body.style.cursor = "";

      const container = document.querySelector(containerSelector);
      if (container) {
        container.removeAttribute("draggable");
      }

      console.log("[useTextDrag] Drag ended");
    };

    // Add event listeners
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("dragend", handleDragEnd);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("dragstart", handleDragStart);
      document.removeEventListener("dragend", handleDragEnd);
    };
  }, [documentId, enabled, containerSelector]);
}

/**
 * Create drag preview element
 */
function createDragPreview(text: string, sourceType: DragSourceType): HTMLElement {
  const preview = document.createElement("div");

  // Truncate text
  const displayText = text.length > 80 ? text.substring(0, 80) + "..." : text;

  // Get icon and colors based on source type
  let icon = "📝";
  let gradient = "from-orange-500 to-red-500";

  switch (sourceType) {
    case "heading":
      icon = "#️⃣";
      gradient = "from-amber-500 to-orange-600";
      break;
    case "code":
      icon = "💻";
      gradient = "from-gray-700 to-gray-900";
      break;
    case "paragraph":
      icon = "📄";
      gradient = "from-indigo-500 to-purple-600";
      break;
    case "list-item":
      icon = "📋";
      gradient = "from-blue-500 to-indigo-600";
      break;
  }

  preview.style.cssText = `
    position: fixed;
    top: -1000px;
    left: -1000px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #f97316, #dc2626);
    color: white;
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.2);
    font-size: 14px;
    font-weight: 600;
    max-width: 400px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 10000;
    backdrop-filter: blur(10px);
  `;

  preview.innerHTML = `
    <span style="font-size: 20px; flex-shrink: 0;">${icon}</span>
    <div style="flex: 1; min-width: 0;">
      <div style="font-size: 10px; text-transform: uppercase; opacity: 0.8; margin-bottom: 4px; letter-spacing: 0.5px;">
        ${getSourceLabel(sourceType)}
      </div>
      <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${displayText}
      </div>
    </div>
    <span style="font-size: 12px; opacity: 0.7; flex-shrink: 0;">→ Canvas</span>
  `;

  return preview;
}

function getSourceLabel(sourceType: DragSourceType): string {
  switch (sourceType) {
    case "heading":
      return "Heading";
    case "paragraph":
      return "Paragraph";
    case "code":
      return "Code Block";
    case "list-item":
      return "List Item";
    case "text":
      return "Text Selection";
    default:
      return "Content";
  }
}
