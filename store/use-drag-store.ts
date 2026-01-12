/**
 * Drag Store - Zustand Global State for Drag Operations
 * 
 * Manages global drag state for:
 * - Text-to-canvas drag operations
 * - Block reordering
 * - Cross-component drag awareness
 * 
 * Benefits:
 * 1. Any component can know if a drag is in progress
 * 2. Unified drag payload management
 * 3. Easy to add drag previews/overlays
 * 4. No more scattered state in refs
 */

import { create } from "zustand";

interface DragPayload {
    type: "text" | "block" | "image" | "file";
    content: string;
    sourceBlockId?: string;
    metadata?: Record<string, any>;
}

interface DragStore {
    // State
    isDragging: boolean;
    dragPayload: DragPayload | null;
    dropTargetId: string | null;

    // Actions
    startDrag: (payload: DragPayload) => void;
    endDrag: () => void;
    setDropTarget: (targetId: string | null) => void;
    getDragPayload: () => DragPayload | null;
}

export const useDragStore = create<DragStore>((set, get) => ({
    // Initial state
    isDragging: false,
    dragPayload: null,
    dropTargetId: null,

    /**
     * Start a drag operation
     */
    startDrag: (payload: DragPayload) => {
        set({
            isDragging: true,
            dragPayload: payload
        });
    },

    /**
     * End drag operation (successful or cancelled)
     */
    endDrag: () => {
        set({
            isDragging: false,
            dragPayload: null,
            dropTargetId: null
        });
    },

    /**
     * Set the current drop target (for hover effects)
     */
    setDropTarget: (targetId: string | null) => {
        set({ dropTargetId: targetId });
    },

    /**
     * Get current drag payload (for drop handlers)
     */
    getDragPayload: () => {
        return get().dragPayload;
    },
}));

/**
 * Selector hooks for optimized subscriptions
 */
export const useIsDragging = () =>
    useDragStore((state) => state.isDragging);

export const useDragPayload = () =>
    useDragStore((state) => state.dragPayload);

export const useDropTargetId = () =>
    useDragStore((state) => state.dropTargetId);
