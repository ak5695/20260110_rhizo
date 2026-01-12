/**
 * Drag-Drop Bridge
 *
 * Core logic for document-to-canvas drag operations
 * Handles data transformation, element creation, and binding
 */

"use client";

import { v4 as uuidv4 } from "uuid";
import {
  DragPayload,
  DropResult,
  ElementCreationConfig,
  BindingCreationOptions,
  DEFAULT_STYLE_PRESETS,
  CoordinateConverter,
  DRAG_MIME_TYPE,
  ExcalidrawElement,
} from "./drag-drop-types";

/**
 * DragDropBridge - Main controller for drag-drop operations
 */
export class DragDropBridge {
  private coordinateConverter: CoordinateConverter | null = null;

  /**
   * Set coordinate converter for screen-to-canvas transformation
   */
  setCoordinateConverter(converter: CoordinateConverter) {
    this.coordinateConverter = converter;
  }

  /**
   * Serialize drag payload to string
   */
  serializeDragPayload(payload: DragPayload): string {
    return JSON.stringify(payload);
  }

  /**
   * Deserialize drag payload from string
   */
  deserializeDragPayload(data: string): DragPayload | null {
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error("[DragDropBridge] Failed to parse drag payload:", error);
      return null;
    }
  }

  /**
   * Create drag payload from document selection
   */
  createDragPayload(config: {
    text: string;
    documentId: string;
    blockId?: string;
    semanticNodeId?: string;
    sourceType?: DragPayload["sourceType"];
    metadata?: any;
  }): DragPayload {
    return {
      sourceType: config.sourceType || "text",
      documentId: config.documentId,
      blockId: config.blockId,
      semanticNodeId: config.semanticNodeId,
      text: config.text,
      metadata: config.metadata,
      timestamp: Date.now(),
    };
  }

  /**
   * Convert screen coordinates to canvas coordinates
   */
  screenToCanvasCoordinates(
    screenX: number,
    screenY: number,
    canvasBounds: DOMRect,
    appState: any // Excalidraw app state
  ): { x: number; y: number } {
    // Use custom converter if available
    if (this.coordinateConverter) {
      return this.coordinateConverter.screenToCanvas(screenX, screenY);
    }

    // Fallback: calculate from canvas bounds and zoom
    const zoom = appState?.zoom?.value || 1;
    const scrollX = appState?.scrollX || 0;
    const scrollY = appState?.scrollY || 0;

    const relativeX = screenX - canvasBounds.left;
    const relativeY = screenY - canvasBounds.top;

    return {
      x: relativeX / zoom - scrollX,
      y: relativeY / zoom - scrollY,
    };
  }

  /**
   * Create Excalidraw text element from drag payload
   */
  createTextElement(config: ElementCreationConfig): ExcalidrawElement {
    const {
      x,
      y,
      text = "",
      width,
      height,
      backgroundColor,
      strokeColor,
    } = config;

    // Auto-calculate dimensions based on text
    const calculatedWidth = width || Math.max(200, Math.min(text.length * 8, 600));
    const calculatedHeight = height || Math.max(40, Math.ceil(text.length / 50) * 25);

    const element: any = {
      id: uuidv4(),
      type: "text",
      x,
      y,
      width: calculatedWidth,
      height: calculatedHeight,
      angle: 0,
      strokeColor: strokeColor || "#1e1e1e",
      backgroundColor: backgroundColor || "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: Math.floor(Math.random() * 100000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 100000),
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      text,
      fontSize: 16,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "top",
      baseline: 14,
      containerId: null,
      originalText: text,
      lineHeight: 1.25,
    };

    return element as ExcalidrawElement;
  }

  /**
   * Create Excalidraw sticky note element from drag payload
   */
  createStickyNoteElement(config: ElementCreationConfig): ExcalidrawElement[] {
    const { x, y, text = "", bindingMetadata } = config;

    // Get style preset based on source type
    const sourceType = bindingMetadata?.sourceType || "text";
    const preset = DEFAULT_STYLE_PRESETS[sourceType];

    // Create rectangle background
    const rectId = uuidv4();
    const textId = uuidv4();

    const width = Math.max(200, Math.min(text.length * 8, 400));
    const height = Math.max(100, Math.ceil(text.length / 40) * 25 + 40);

    const rectangle: any = {
      id: rectId,
      type: "rectangle",
      x,
      y,
      width,
      height,
      angle: 0,
      strokeColor: preset.strokeColor,
      backgroundColor: preset.backgroundColor,
      fillStyle: preset.fillStyle,
      strokeWidth: preset.strokeWidth,
      strokeStyle: "solid",
      roughness: preset.roughness,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: { type: 3 },
      seed: Math.floor(Math.random() * 100000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 100000),
      isDeleted: false,
      boundElements: [{ type: "text", id: textId }],
      updated: Date.now(),
      link: null,
      locked: false,
    };

    const textElement: any = {
      id: textId,
      type: "text",
      x: x + 10,
      y: y + 10,
      width: width - 20,
      height: height - 20,
      angle: 0,
      strokeColor: preset.strokeColor,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: Math.floor(Math.random() * 100000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 100000),
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      text,
      fontSize: 16,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "top",
      baseline: 14,
      containerId: rectId,
      originalText: text,
      lineHeight: 1.25,
    };

    return [rectangle, textElement] as ExcalidrawElement[];
  }

  /**
   * Create element from drag payload
   */
  async createElement(
    payload: DragPayload,
    position: { x: number; y: number },
    options: {
      style?: "text" | "sticky-note";
    } = {}
  ): Promise<ExcalidrawElement[]> {
    const { text, sourceType, documentId, blockId, semanticNodeId } = payload;
    const style = options.style || "sticky-note";

    const config: ElementCreationConfig = {
      type: style === "sticky-note" ? "rectangle" : "text",
      x: position.x,
      y: position.y,
      text,
      bindingMetadata: {
        sourceType,
        documentId,
        blockId,
        semanticNodeId,
      },
    };

    if (style === "sticky-note") {
      return this.createStickyNoteElement(config);
    } else {
      return [this.createTextElement(config)];
    }
  }

  /**
   * Create binding configuration from drag payload
   */
  createBindingConfig(
    payload: DragPayload,
    elementIds: string[]
  ): BindingCreationOptions {
    return {
      bindingType: "direct",
      direction: "doc_to_canvas",
      provenance: "drag_drop",
      anchorText: payload.text,
      semanticLabel: payload.metadata?.semanticLabel,
      requiresReview: false, // User initiated, no review needed
      metadata: {
        dragTimestamp: payload.timestamp,
        sourceType: payload.sourceType,
        elementIds,
      },
    };
  }

  /**
   * Validate drop operation
   */
  validateDrop(payload: DragPayload): {
    isValid: boolean;
    reason?: string;
  } {
    // Check payload integrity
    if (!payload.text || !payload.documentId) {
      return {
        isValid: false,
        reason: "Invalid drag payload: missing required fields",
      };
    }

    // Check text length
    if (payload.text.length > 5000) {
      return {
        isValid: false,
        reason: "Text too long (max 5000 characters)",
      };
    }

    return { isValid: true };
  }

  /**
   * Calculate optimal element position
   * Avoids overlapping with existing elements
   */
  calculateOptimalPosition(
    basePosition: { x: number; y: number },
    existingElements: ExcalidrawElement[]
  ): { x: number; y: number } {
    let { x, y } = basePosition;
    const OFFSET = 20;
    const MAX_ATTEMPTS = 10;

    // Simple collision detection
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const overlaps = existingElements.some((el) => {
        if (el.type === "text" || el.type === "rectangle") {
          const elX = el.x;
          const elY = el.y;
          const distance = Math.sqrt(
            Math.pow(x - elX, 2) + Math.pow(y - elY, 2)
          );
          return distance < 100; // Minimum distance threshold
        }
        return false;
      });

      if (!overlaps) {
        break;
      }

      // Try offset position
      x += OFFSET;
      y += OFFSET;
    }

    return { x, y };
  }
}

// Singleton instance
export const dragDropBridge = new DragDropBridge();
