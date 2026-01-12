/**
 * Layout Store - Zustand Global State for Editor Layout Management
 * 
 * Manages the layout state that was previously in page.tsx:
 * - Canvas visibility (open/closed)
 * - Canvas fullscreen mode
 * - Document outline visibility
 * 
 * Benefits:
 * 1. No more props drilling to Navbar, ExcalidrawCanvas, etc.
 * 2. Any component can control layout without passing callbacks
 * 3. Persisted layout preferences (future: localStorage)
 */

import { create } from "zustand";

interface LayoutStore {
    // State
    isCanvasOpen: boolean;
    isCanvasFullscreen: boolean;
    isOutlineOpen: boolean;

    // Actions
    toggleCanvas: () => void;
    toggleFullscreen: () => void;
    toggleOutline: () => void;
    openCanvas: () => void;
    closeCanvas: () => void;
    setCanvasFullscreen: (isFullscreen: boolean) => void;
}

export const useLayoutStore = create<LayoutStore>((set, get) => ({
    // Initial state
    isCanvasOpen: true,
    isCanvasFullscreen: false,
    isOutlineOpen: false,

    /**
     * Toggle canvas visibility
     */
    toggleCanvas: () => {
        set((state) => ({ isCanvasOpen: !state.isCanvasOpen }));
    },

    /**
     * Toggle canvas fullscreen mode
     */
    toggleFullscreen: () => {
        const { isCanvasFullscreen, isCanvasOpen } = get();

        // If going fullscreen, ensure canvas is open
        if (!isCanvasFullscreen && !isCanvasOpen) {
            set({ isCanvasOpen: true });
        }

        set({ isCanvasFullscreen: !isCanvasFullscreen });
    },

    /**
     * Toggle document outline visibility
     */
    toggleOutline: () => {
        set((state) => ({ isOutlineOpen: !state.isOutlineOpen }));
    },

    /**
     * Open canvas (used by drag-drop to auto-show canvas)
     */
    openCanvas: () => {
        set({ isCanvasOpen: true });
    },

    /**
     * Close canvas
     */
    closeCanvas: () => {
        set({ isCanvasOpen: false });
    },

    /**
     * Set fullscreen mode explicitly
     */
    setCanvasFullscreen: (isFullscreen: boolean) => {
        if (isFullscreen) {
            set({ isCanvasOpen: true, isCanvasFullscreen: true });
        } else {
            set({ isCanvasFullscreen: false });
        }
    },
}));

/**
 * Selector hooks for optimized subscriptions
 */
export const useCanvasOpen = () =>
    useLayoutStore((state) => state.isCanvasOpen);

export const useCanvasFullscreen = () =>
    useLayoutStore((state) => state.isCanvasFullscreen);

export const useOutlineOpen = () =>
    useLayoutStore((state) => state.isOutlineOpen);
