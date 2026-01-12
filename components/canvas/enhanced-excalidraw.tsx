/**
 * Enhanced Excalidraw Component
 *
 * Wraps Excalidraw with drag-drop support and canvas storage integration
 * Handles element creation, binding management, and real-time sync
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import { CanvasDropZone } from "./canvas-drop-zone";
import { createCanvasBinding, saveCanvasElements } from "@/actions/canvas-bindings";
import type { DropResult, ExcalidrawElement } from "@/lib/canvas/drag-drop-types";

// AppState type from Excalidraw - using simplified version
type AppState = any;

interface EnhancedExcalidrawProps {
  canvasId: string;
  documentId: string;
  initialElements?: ExcalidrawElement[];
  onSave?: (elements: ExcalidrawElement[]) => void;
}

export const EnhancedExcalidraw: React.FC<EnhancedExcalidrawProps> = ({
  canvasId,
  documentId,
  initialElements = [],
  onSave,
}) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [elements, setElements] = useState<ExcalidrawElement[]>(initialElements);

  // Handle elements created from drag-drop
  const handleElementsCreated = useCallback(
    async (newElements: ExcalidrawElement[]) => {
      try {
        console.log("[EnhancedExcalidraw] Elements created:", newElements.length);

        // Add elements to Excalidraw
        if (excalidrawAPI) {
          const currentElements = excalidrawAPI.getSceneElements();
          const updatedElements = [...currentElements, ...newElements];
          excalidrawAPI.updateScene({
            elements: updatedElements,
          });

          // Update local state
          setElements(updatedElements);

          // Save to database
          await saveCanvasElements(
            canvasId,
            newElements.map((el) => ({
              id: el.id,
              type: el.type,
              x: el.x,
              y: el.y,
              width: el.width,
              height: el.height,
              angle: el.angle,
              data: el,
            }))
          );

          // Notify parent
          onSave?.(updatedElements);
        }
      } catch (error) {
        console.error("[EnhancedExcalidraw] Error adding elements:", error);
      }
    },
    [excalidrawAPI, canvasId, onSave]
  );

  // Handle binding creation from drag-drop
  const handleBindingCreated = useCallback(
    async (result: DropResult) => {
      try {
        if (!result.success) {
          console.warn("[EnhancedExcalidraw] Drop was not successful");
          return;
        }

        console.log("[EnhancedExcalidraw] Drop result:", result);
        // TODO: Implement binding creation with available result data (elementIds, position)
        // For now, just log the result
      } catch (error) {
        console.error("[EnhancedExcalidraw] Error processing drop result:", error);
      }
    },
    []
  );

  // Handle Excalidraw onChange
  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState) => {
      setElements([...elements]);
      // TODO: Debounced save to database for user edits
    },
    []
  );

  return (
    <CanvasDropZone
      canvasId={canvasId}
      documentId={documentId}
      onElementsCreated={handleElementsCreated}
      onBindingCreated={handleBindingCreated}
      className="w-full h-full"
    >
      <Excalidraw
        excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
        initialData={{
          elements: initialElements,
          appState: {
            viewBackgroundColor: "#ffffff",
          },
        }}
        onChange={handleChange}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
          },
        }}
      />
    </CanvasDropZone>
  );
};

export default EnhancedExcalidraw;
