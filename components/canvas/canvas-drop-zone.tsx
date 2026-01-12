/**
 * Canvas Drop Zone Component
 *
 * Wraps the canvas area to handle drop events from draggable document content
 * Provides visual feedback during drag operations
 */

"use client";

import React, { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { dragDropBridge } from "@/lib/canvas/drag-drop-bridge";
import { DRAG_MIME_TYPE, DragPayload, DropResult, ExcalidrawElement } from "@/lib/canvas/drag-drop-types";

interface CanvasDropZoneProps {
  children: React.ReactNode;
  canvasId: string;
  documentId: string;
  onElementsCreated?: (elements: ExcalidrawElement[]) => void;
  onBindingCreated?: (result: DropResult) => void;
  className?: string;
}

export const CanvasDropZone: React.FC<CanvasDropZoneProps> = ({
  children,
  canvasId,
  documentId,
  onElementsCreated,
  onBindingCreated,
  className,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if this is our custom drag type
    if (e.dataTransfer.types.includes(DRAG_MIME_TYPE)) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.types.includes(DRAG_MIME_TYPE)) {
      e.dataTransfer.dropEffect = "copy";

      // Update drag position for visual feedback
      if (dropZoneRef.current) {
        const rect = dropZoneRef.current.getBoundingClientRect();
        setDragPosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only hide if we're leaving the drop zone entirely
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragOver(false);
      setDragPosition(null);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragOver(false);
    setDragPosition(null);

    try {
      // Get drag payload
      const payloadStr = e.dataTransfer.getData(DRAG_MIME_TYPE);
      if (!payloadStr) {
        console.warn("[CanvasDropZone] No drag payload found");
        return;
      }

      const payload = dragDropBridge.deserializeDragPayload(payloadStr);

      if (!payload) {
        console.warn("[CanvasDropZone] Failed to parse drag payload");
        return;
      }

      // Validate drop
      const validation = dragDropBridge.validateDrop(payload);
      if (!validation.isValid) {
        console.warn("[CanvasDropZone] Invalid drop:", validation.reason);
        return;
      }

      // Get drop position in canvas coordinates
      if (!dropZoneRef.current) return;

      const rect = dropZoneRef.current.getBoundingClientRect();
      const screenPosition = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      // TODO: Transform screen coordinates to canvas coordinates
      // This will need to account for canvas pan/zoom state
      // For now, using screen position directly
      const canvasPosition = screenPosition;

      // Create elements
      const elements = await dragDropBridge.createElement(payload, canvasPosition);

      if (elements.length === 0) {
        console.warn("[CanvasDropZone] No elements created");
        return;
      }

      // Notify parent component
      onElementsCreated?.(elements);

      // Create binding (this will be persisted to database)
      const result: DropResult = {
        success: true,
        elements,
        elementIds: elements.map(el => el.id),
        position: canvasPosition,
      };

      onBindingCreated?.(result);

      console.log("[CanvasDropZone] Drop successful:", result);
    } catch (error) {
      console.error("[CanvasDropZone] Drop error:", error);
    }
  }, [canvasId, documentId, onElementsCreated, onBindingCreated]);

  return (
    <div
      ref={dropZoneRef}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative w-full h-full transition-all",
        className
      )}
    >
      {/* Visual feedback overlay */}
      {isDragOver && (
        <div className="absolute inset-0 pointer-events-none z-50">
          {/* Border highlight */}
          <div className="absolute inset-0 border-4 border-orange-500/50 rounded-lg bg-orange-500/5 backdrop-blur-sm animate-pulse" />

          {/* Drop indicator at cursor position */}
          {dragPosition && (
            <div
              className="absolute w-3 h-3 bg-orange-500 rounded-full shadow-lg"
              style={{
                left: dragPosition.x - 6,
                top: dragPosition.y - 6,
                boxShadow: "0 0 20px rgba(249, 115, 22, 0.6)",
              }}
            >
              {/* Ripple effect */}
              <div className="absolute inset-0 bg-orange-500 rounded-full animate-ping opacity-75" />
            </div>
          )}

          {/* Drop hint text */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-medium rounded-lg shadow-lg">
            Release to add to canvas
          </div>
        </div>
      )}

      {children}
    </div>
  );
};
