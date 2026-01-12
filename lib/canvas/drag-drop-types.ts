/**
 * Drag & Drop Type Definitions
 *
 * Comprehensive type system for document-to-canvas drag operations
 */

// ExcalidrawElement type - using any to avoid import path issues
// Original: import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
export type ExcalidrawElement = any;

/**
 * Drag Data Transfer Format
 * Custom MIME type for our application
 */
export const DRAG_MIME_TYPE = "application/x-notion-canvas-drag";

/**
 * Drag Source Types
 */
export type DragSourceType =
  | "text"           // Plain text selection
  | "block"          // Entire block
  | "heading"        // Heading block
  | "paragraph"      // Paragraph block
  | "list-item"      // List item
  | "code"           // Code block
  | "semantic-node"; // Semantic node

/**
 * Drag Payload - Data transferred during drag operation
 */
export interface DragPayload {
  sourceType: DragSourceType;

  // Source identifiers
  documentId: string;
  blockId?: string;
  semanticNodeId?: string;

  // Content
  text: string;
  richText?: any; // BlockNote rich text format

  // Selection range
  selectionRange?: {
    start: number;
    end: number;
  };

  // Metadata
  metadata?: {
    blockType?: string;
    semanticLabel?: string;
    tags?: string[];
    [key: string]: any;
  };

  // Timestamp
  timestamp: number;
}

/**
 * Drop Result - Result of drop operation
 */
export interface DropResult {
  success: boolean;

  // Created elements
  elementIds: string[];
  elements: ExcalidrawElement[];

  // Created binding
  bindingId?: string;

  // Position where dropped
  position: {
    x: number;
    y: number;
  };

  // Error if any
  error?: string;
}

/**
 * Canvas Element Creation Config
 * Configuration for converting drag data to canvas element
 */
export interface ElementCreationConfig {
  type: "text" | "rectangle" | "ellipse" | "sticky-note";

  // Position
  x: number;
  y: number;

  // Dimensions (optional, auto-calculated if not provided)
  width?: number;
  height?: number;

  // Content
  text?: string;

  // Style
  backgroundColor?: string;
  strokeColor?: string;
  fillStyle?: "solid" | "hachure" | "cross-hatch";

  // Binding metadata
  bindingMetadata?: {
    sourceType: DragSourceType;
    documentId: string;
    blockId?: string;
    semanticNodeId?: string;
  };
}

/**
 * Drag Preview Configuration
 */
export interface DragPreviewConfig {
  // Preview content
  text: string;
  maxLength?: number;

  // Visual style
  backgroundColor?: string;
  borderColor?: string;

  // Size constraints
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * Drop Zone Configuration
 */
export interface DropZoneConfig {
  // Is drop zone active
  isActive: boolean;

  // Allowed source types
  allowedSourceTypes?: DragSourceType[];

  // Canvas boundaries
  canvasBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // Callback when element is created
  onElementCreated?: (elementId: string) => void;

  // Callback when binding is created
  onBindingCreated?: (bindingId: string) => void;
}

/**
 * Drag State - Tracks ongoing drag operation
 */
export interface DragState {
  isDragging: boolean;
  payload: DragPayload | null;
  preview: DragPreviewConfig | null;

  // Current cursor position
  cursorPosition: {
    x: number;
    y: number;
  } | null;

  // Target canvas position (accounting for zoom/pan)
  canvasPosition: {
    x: number;
    y: number;
  } | null;
}

/**
 * Binding Creation Options
 */
export interface BindingCreationOptions {
  // Binding type
  bindingType: "direct" | "reference" | "annotation" | "derived";

  // Direction
  direction: "doc_to_canvas" | "canvas_to_doc" | "bidirectional";

  // Provenance
  provenance: "user" | "ai" | "system" | "drag_drop";

  // Semantic info
  anchorText?: string;
  semanticLabel?: string;

  // Human arbitration
  requiresReview?: boolean;

  // Metadata
  metadata?: Record<string, any>;
}

/**
 * Element Style Preset
 */
export interface ElementStylePreset {
  name: string;
  backgroundColor: string;
  strokeColor: string;
  fillStyle: "solid" | "hachure" | "cross-hatch";
  strokeWidth: number;
  roughness: number;
}

/**
 * Default style presets for different drag source types
 */
export const DEFAULT_STYLE_PRESETS: Record<DragSourceType, ElementStylePreset> = {
  text: {
    name: "Text",
    backgroundColor: "#fff",
    strokeColor: "#000",
    fillStyle: "solid",
    strokeWidth: 1,
    roughness: 0,
  },
  block: {
    name: "Block",
    backgroundColor: "#f0f0f0",
    strokeColor: "#666",
    fillStyle: "hachure",
    strokeWidth: 1,
    roughness: 1,
  },
  heading: {
    name: "Heading",
    backgroundColor: "#e3f2fd",
    strokeColor: "#1976d2",
    fillStyle: "solid",
    strokeWidth: 2,
    roughness: 0,
  },
  paragraph: {
    name: "Paragraph",
    backgroundColor: "#fff",
    strokeColor: "#444",
    fillStyle: "solid",
    strokeWidth: 1,
    roughness: 0,
  },
  "list-item": {
    name: "List Item",
    backgroundColor: "#fff9c4",
    strokeColor: "#f57c00",
    fillStyle: "solid",
    strokeWidth: 1,
    roughness: 0,
  },
  code: {
    name: "Code",
    backgroundColor: "#263238",
    strokeColor: "#00bcd4",
    fillStyle: "solid",
    strokeWidth: 1,
    roughness: 0,
  },
  "semantic-node": {
    name: "Semantic Node",
    backgroundColor: "#e1bee7",
    strokeColor: "#7b1fa2",
    fillStyle: "solid",
    strokeWidth: 2,
    roughness: 0,
  },
};

/**
 * Drag Event Handlers
 */
export interface DragHandlers {
  onDragStart: (payload: DragPayload) => void;
  onDragEnd: () => void;
  onDrop: (payload: DragPayload, position: { x: number; y: number }) => Promise<DropResult>;
}

/**
 * Drop Validation Result
 */
export interface DropValidation {
  isValid: boolean;
  reason?: string;
  suggestions?: string[];
}

/**
 * Canvas Coordinate Converter
 * Converts screen coordinates to canvas coordinates
 */
export interface CoordinateConverter {
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  canvasToScreen: (canvasX: number, canvasY: number) => { x: number; y: number };
}
