/**
 * Sidebar List Cache for Instant Loading
 * 
 * Stores document list in IndexedDB for cache-first rendering
 */

const STORAGE_KEY_PREFIX = "jotion-sidebar-";

class SidebarCache {
    private memoryCache: Map<string, any[]> = new Map(); // L1: Memory cache

    // Synchronous read (LocalStorage + Memory)
    getSync(parentId: string): any[] | null {
        if (typeof window === "undefined") return null;

        const key = parentId || "root";

        // 1. Check Memory
        if (this.memoryCache.has(key)) {
            return this.memoryCache.get(key)!;
        }

        // 2. Check LocalStorage
        try {
            const storageKey = `${STORAGE_KEY_PREFIX}${key}`;
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.memoryCache.set(key, parsed); // Promote to L1
                console.log(`[SidebarCache] LocalStorage hit: ${key}`);
                return parsed;
            }
        } catch (e) {
            console.error("[SidebarCache] Read failed:", e);
        }

        return null;
    }

    // Async wrapper for compatibility (though we don't strictly need it async anymore)
    async get(parentId: string): Promise<any[] | null> {
        return this.getSync(parentId);
    }

    set(parentId: string, documents: any[]): void {
        const key = parentId || "root";

        // 1. Update Memory
        this.memoryCache.set(key, documents);

        // 2. Update LocalStorage
        if (typeof window !== "undefined") {
            try {
                const storageKey = `${STORAGE_KEY_PREFIX}${key}`;
                localStorage.setItem(storageKey, JSON.stringify(documents));
                console.log(`[SidebarCache] Saved to LocalStorage: ${key}`);
            } catch (e) {
                console.error("[SidebarCache] Write failed:", e);
            }
        }
    }

    invalidate(parentId?: string): void {
        const key = parentId || "root";
        this.memoryCache.delete(key);
        if (typeof window !== "undefined") {
            localStorage.removeItem(`${STORAGE_KEY_PREFIX}${key}`);
        }
    }

    clear(): void {
        this.memoryCache.clear();
        if (typeof window !== "undefined") {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith(STORAGE_KEY_PREFIX)) {
                    localStorage.removeItem(key);
                }
            });
        }
    }
}

export const sidebarCache = new SidebarCache();

// Make available in browser console for debugging
if (typeof window !== "undefined") {
    (window as any).__SIDEBAR_CACHE__ = sidebarCache;
}
