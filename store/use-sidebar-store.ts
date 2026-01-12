/**
 * Sidebar Store - Zustand Global State for Sidebar Management
 * 
 * Replaces the previous pattern of:
 * - useState in Navigation
 * - window.dispatchEvent("jotion-sidebar-change")
 * - window.addEventListener in Navbar
 * 
 * Benefits:
 * 1. Single source of truth for sidebar state
 * 2. No more event-based communication
 * 3. Cleaner, more maintainable code
 * 4. Type-safe state management
 */

import { create } from "zustand";

interface SidebarStore {
    // State
    isCollapsed: boolean;
    isResetting: boolean;
    width: number;

    // Actions
    collapse: () => void;
    expand: () => void;
    toggle: () => void;
    setWidth: (width: number) => void;
    setResetting: (isResetting: boolean) => void;
    reset: (isMobile: boolean) => void;
}

const DEFAULT_WIDTH = 240;
const MOBILE_WIDTH = 0;

export const useSidebarStore = create<SidebarStore>((set, get) => ({
    // Initial state
    isCollapsed: false,
    isResetting: false,
    width: DEFAULT_WIDTH,

    /**
     * Collapse the sidebar (width = 0)
     */
    collapse: () => {
        set({
            isCollapsed: true,
            isResetting: true,
            width: MOBILE_WIDTH
        });
        // Reset the transition flag after animation completes
        setTimeout(() => set({ isResetting: false }), 300);
    },

    /**
     * Expand the sidebar to default/previous width
     */
    expand: () => {
        set({
            isCollapsed: false,
            isResetting: true,
            width: DEFAULT_WIDTH
        });
        setTimeout(() => set({ isResetting: false }), 300);
    },

    /**
     * Toggle between collapsed and expanded
     */
    toggle: () => {
        const { isCollapsed } = get();
        if (isCollapsed) {
            get().expand();
        } else {
            get().collapse();
        }
    },

    /**
     * Set custom width (for resize handle)
     */
    setWidth: (width: number) => {
        // Clamp width between min and max
        const clampedWidth = Math.min(Math.max(width, 240), 480);
        set({ width: clampedWidth });
    },

    /**
     * Set resetting state (for CSS transitions)
     */
    setResetting: (isResetting: boolean) => {
        set({ isResetting });
    },

    /**
     * Reset sidebar based on device type
     */
    reset: (isMobile: boolean) => {
        if (isMobile) {
            set({
                isCollapsed: true,
                width: MOBILE_WIDTH,
                isResetting: true
            });
        } else {
            set({
                isCollapsed: false,
                width: DEFAULT_WIDTH,
                isResetting: true
            });
        }
        setTimeout(() => set({ isResetting: false }), 300);
    },
}));

/**
 * Selector hooks for optimized subscriptions
 */
export const useSidebarCollapsed = () =>
    useSidebarStore((state) => state.isCollapsed);

export const useSidebarWidth = () =>
    useSidebarStore((state) => state.width);

export const useSidebarResetting = () =>
    useSidebarStore((state) => state.isResetting);
