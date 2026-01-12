/**
 * Navigation Store - Zustand Global State for Canvas-Document Navigation
 * 
 * Manages bidirectional navigation between:
 * - Document blocks (Editor)
 * - Canvas elements (Excalidraw)
 * 
 * Replaces the previous pattern of:
 * - window.dispatchEvent("document:jump-to-block")
 * - window.dispatchEvent("canvas:jump-to-element")
 * - window.addEventListener for both events
 * 
 * Benefits:
 * 1. Type-safe navigation commands
 * 2. No more event string typos
 * 3. Centralized navigation logic
 * 4. Easy to add animations/highlighting
 */

import { create } from "zustand";

interface NavigationTarget {
    id: string;
    label?: string;
    timestamp: number;
}

interface NavigationStore {
    // State
    blockTarget: NavigationTarget | null;      // Document block to jump to
    elementTarget: NavigationTarget | null;    // Canvas element to jump to
    highlightedBlockId: string | null;         // Currently highlighted block
    highlightedElementId: string | null;       // Currently highlighted element

    // Actions
    jumpToBlock: (blockId: string, label?: string) => void;
    jumpToElement: (elementId: string, label?: string) => void;
    clearBlockTarget: () => void;
    clearElementTarget: () => void;
    setHighlightedBlock: (blockId: string | null) => void;
    setHighlightedElement: (elementId: string | null) => void;
}

export const useNavigationStore = create<NavigationStore>((set) => ({
    // Initial state
    blockTarget: null,
    elementTarget: null,
    highlightedBlockId: null,
    highlightedElementId: null,

    /**
     * Request navigation to a document block
     * Called from Canvas when user clicks a linked element
     */
    jumpToBlock: (blockId: string, label?: string) => {
        set({
            blockTarget: {
                id: blockId,
                label,
                timestamp: Date.now()
            },
            highlightedBlockId: blockId
        });

        // Auto-clear highlight after 2 seconds
        setTimeout(() => {
            set((state) =>
                state.highlightedBlockId === blockId
                    ? { highlightedBlockId: null }
                    : {}
            );
        }, 2000);
    },

    /**
     * Request navigation to a canvas element
     * Called from Editor when user clicks a linked block
     */
    jumpToElement: (elementId: string, label?: string) => {
        set({
            elementTarget: {
                id: elementId,
                label,
                timestamp: Date.now()
            },
            highlightedElementId: elementId
        });

        // Auto-clear highlight after 2 seconds
        setTimeout(() => {
            set((state) =>
                state.highlightedElementId === elementId
                    ? { highlightedElementId: null }
                    : {}
            );
        }, 2000);
    },

    /**
     * Clear block navigation target (after navigation is complete)
     */
    clearBlockTarget: () => {
        set({ blockTarget: null });
    },

    /**
     * Clear element navigation target (after navigation is complete)
     */
    clearElementTarget: () => {
        set({ elementTarget: null });
    },

    /**
     * Set highlighted block for visual feedback
     */
    setHighlightedBlock: (blockId: string | null) => {
        set({ highlightedBlockId: blockId });
    },

    /**
     * Set highlighted element for visual feedback
     */
    setHighlightedElement: (elementId: string | null) => {
        set({ highlightedElementId: elementId });
    },
}));

/**
 * Selector hooks for optimized subscriptions
 */
export const useBlockTarget = () =>
    useNavigationStore((state) => state.blockTarget);

export const useElementTarget = () =>
    useNavigationStore((state) => state.elementTarget);

export const useHighlightedBlockId = () =>
    useNavigationStore((state) => state.highlightedBlockId);

export const useHighlightedElementId = () =>
    useNavigationStore((state) => state.highlightedElementId);
