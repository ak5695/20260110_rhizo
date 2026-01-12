/**
 * Drag Button Component
 *
 * Shows a draggable button when text is selected
 * User can drag this button to canvas to create visual elements
 */

"use client";

import { useEffect, useState, useRef } from "react";
import { Move, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { dragDropBridge } from "@/lib/canvas/drag-drop-bridge";
import { DRAG_MIME_TYPE, DragSourceType } from "@/lib/canvas/drag-drop-types";

interface DragButtonProps {
  documentId: string;
  containerSelector?: string;
}

export const DragButton: React.FC<DragButtonProps> = ({
  documentId,
  containerSelector = ".bn-container",
}) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Listen for selection changes and show button directly
  useEffect(() => {
    const handleSelectionChange = () => {
      // Clear existing timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        // Hide button after a short delay
        hideTimeoutRef.current = setTimeout(() => {
          setVisible(false);
        }, 300);
        return;
      }

      const text = selection.toString().trim();

      // Show for any non-empty selection
      if (text.length > 0) {
        setSelectedText(text);

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Position button to the right of selection
        setPosition({
          x: rect.right + 10,
          y: rect.top + rect.height / 2,
        });

        setVisible(true);
      } else {
        hideTimeoutRef.current = setTimeout(() => {
          setVisible(false);
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
  }, []);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);

    // Find block context
    let blockId: string | undefined;
    let sourceType: DragSourceType = "text";

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const element = container.nodeType === 3 ? container.parentElement : container as HTMLElement;

      // Find BlockNote block
      const blockElement = element?.closest("[data-node-type], [data-id]");
      if (blockElement) {
        blockId = blockElement.getAttribute("data-id") || undefined;
        const nodeType = blockElement.getAttribute("data-node-type");

        // Determine source type
        if (nodeType?.includes("heading")) {
          sourceType = "heading";
        } else if (nodeType === "code") {
          sourceType = "code";
        } else if (nodeType === "listItem") {
          sourceType = "list-item";
        }
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
        draggedFromButton: true,
      },
    });

    // Set drag data
    e.dataTransfer.setData(DRAG_MIME_TYPE, dragDropBridge.serializeDragPayload(payload));
    e.dataTransfer.setData("text/plain", selectedText);
    e.dataTransfer.effectAllowed = "copy";

    // Create custom drag image
    const dragImage = createDragImage(selectedText, sourceType);
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 150, 30);

    // Clean up drag image
    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage);
      }
    }, 0);

    console.log("[DragButton] Drag started:", { text: selectedText.substring(0, 50), sourceType });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    console.log("[DragButton] Drag ended");
  };

  if (!visible) return null;

  return (
    <div
      ref={buttonRef}
      className="fixed z-[9999] pointer-events-auto"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translateY(-50%)",
      }}
    >
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-lg shadow-xl cursor-grab active:cursor-grabbing",
          "bg-gradient-to-r from-orange-500 to-red-500 text-white",
          "hover:from-orange-600 hover:to-red-600",
          "transition-all duration-200 hover:scale-110",
          "border-2 border-white/30",
          "animate-in fade-in slide-in-from-left-2 duration-300",
          isDragging && "opacity-50 scale-90"
        )}
        title="Drag to canvas"
      >
        <GripVertical className="w-4 h-4" />
        <Move className="w-4 h-4" />
      </div>

      {/* Connecting line to selection */}
      <svg
        className="absolute right-full top-1/2 -translate-y-1/2 pointer-events-none"
        width="10"
        height="2"
        style={{ marginRight: "2px" }}
      >
        <line
          x1="0"
          y1="1"
          x2="10"
          y2="1"
          stroke="rgb(249 115 22)"
          strokeWidth="2"
          strokeDasharray="2,2"
        />
      </svg>
    </div>
  );
};

/**
 * Create drag preview with hand-drawn style
 */
function createDragImage(text: string, sourceType: DragSourceType): HTMLElement {
  const preview = document.createElement("div");

  // Truncate text
  const displayText = text.length > 80 ? text.substring(0, 80) + "..." : text;

  // Get icon and colors
  let icon = "📝";
  let bgColor = "#fef3c7"; // Amber for default
  let borderColor = "#f59e0b";

  switch (sourceType) {
    case "heading":
      icon = "#️⃣";
      bgColor = "#fef3c7"; // Amber
      borderColor = "#f59e0b";
      break;
    case "code":
      icon = "💻";
      bgColor = "#1f2937"; // Dark gray
      borderColor = "#4b5563";
      break;
    case "list-item":
      icon = "📋";
      bgColor = "#e0e7ff"; // Indigo
      borderColor = "#6366f1";
      break;
  }

  preview.style.cssText = `
    position: fixed;
    top: -1000px;
    left: -1000px;
    width: 280px;
    padding: 16px;
    background: ${bgColor};
    border: 3px solid ${borderColor};
    border-radius: 8px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
    font-family: "Comic Sans MS", "Segoe UI Emoji", sans-serif;
    z-index: 10000;
  `;

  preview.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <span style="font-size: 24px; flex-shrink: 0;">${icon}</span>
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 12px; color: ${sourceType === 'code' ? '#9ca3af' : '#6b7280'}; margin-bottom: 6px; font-weight: 600;">
          ${getSourceLabel(sourceType).toUpperCase()}
        </div>
        <div style="
          font-size: 14px;
          color: ${sourceType === 'code' ? '#f3f4f6' : '#1f2937'};
          line-height: 1.5;
          word-wrap: break-word;
          overflow-wrap: break-word;
        ">
          ${displayText}
        </div>
      </div>
    </div>
    <div style="
      margin-top: 12px;
      padding-top: 12px;
      border-top: 2px dashed ${borderColor}40;
      text-align: center;
      font-size: 11px;
      color: ${sourceType === 'code' ? '#9ca3af' : '#6b7280'};
      font-weight: bold;
    ">
      → Drag to Canvas
    </div>
  `;

  return preview;
}

function getSourceLabel(sourceType: DragSourceType): string {
  switch (sourceType) {
    case "heading":
      return "Heading";
    case "code":
      return "Code Block";
    case "list-item":
      return "List Item";
    case "text":
      return "Text";
    case "block":
      return "Block";
    case "semantic-node":
      return "Concept";
    default:
      return "Content";
  }
}
