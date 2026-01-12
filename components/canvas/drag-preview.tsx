/**
 * Drag Preview Component
 *
 * Visual preview shown while dragging content from document to canvas
 * Provides rich visual feedback about what's being dragged
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { DragSourceType } from "@/lib/canvas/drag-drop-types";
import { FileText, Hash, Code, List, CheckSquare } from "lucide-react";

interface DragPreviewProps {
  text: string;
  sourceType: DragSourceType;
  className?: string;
}

const getSourceIcon = (sourceType: DragSourceType) => {
  switch (sourceType) {
    case "heading":
      return <Hash className="w-4 h-4" />;
    case "code":
      return <Code className="w-4 h-4" />;
    case "list-item":
      return <List className="w-4 h-4" />;
    default:
      return <FileText className="w-4 h-4" />;
  }
};

const getSourceLabel = (sourceType: DragSourceType) => {
  switch (sourceType) {
    case "heading":
      return "Heading";
    case "code":
      return "Code Block";
    case "list-item":
      return "List Item";
    case "block":
      return "Block";
    case "semantic-node":
      return "Concept";
    default:
      return "Text";
  }
};

export const DragPreview: React.FC<DragPreviewProps> = ({
  text,
  sourceType,
  className,
}) => {
  // Truncate long text for preview
  const displayText = text.length > 100 ? text.substring(0, 100) + "..." : text;

  return (
    <div
      className={cn(
        "fixed pointer-events-none z-[9999] px-4 py-3 rounded-lg shadow-2xl backdrop-blur-md border-2",
        "bg-gradient-to-br from-orange-500/90 to-red-500/90 border-orange-300/50",
        "text-white font-medium text-sm max-w-md",
        "transform transition-transform",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-8 h-8 rounded-md bg-white/20 flex items-center justify-center">
          {getSourceIcon(sourceType)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Source type badge */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wide opacity-80">
              {getSourceLabel(sourceType)}
            </span>
            <div className="h-1 w-1 rounded-full bg-white/60" />
            <span className="text-[10px] opacity-60">Drag to canvas</span>
          </div>

          {/* Preview text */}
          <div className="text-sm leading-relaxed line-clamp-3">
            {displayText}
          </div>
        </div>
      </div>

      {/* Animated border shimmer */}
      <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
      </div>
    </div>
  );
};

// Custom CSS for shimmer animation (add to global CSS)
export const dragPreviewStyles = `
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}
`;
