/**
 * Sidebar List Cache for Instant Loading
 * 
 * Stores document list in IndexedDB for cache-first rendering
 */

const DB_NAME = "jotion-sidebar-cache";
const DB_VERSION = 1;
const STORE_NAME = "sidebar";

interface CachedSidebar {
    parentId: string; // "root" for top-level
    documents: any[];
    timestamp: number;
}

class SidebarCache {
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void> | null = null;
    private memoryCache: Map<string, any[]> = new Map(); // L1: Memory cache

    async init(): Promise<void> {
        if (typeof window === "undefined") return;
        if (this.db) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                console.log("[SidebarCache] Initialized");
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: "parentId" });
                }
            };
        });

        return this.initPromise;
    }

    // Synchronous memory cache read (instant)
    getSync(parentId: string): any[] | null {
        const key = parentId || "root";
        return this.memoryCache.get(key) || null;
    }

    async get(parentId: string): Promise<any[] | null> {
        const key = parentId || "root";

        // L1: Check memory cache first
        const memHit = this.memoryCache.get(key);
        if (memHit) {
            console.log(`[SidebarCache] Memory hit: ${key}`);
            return memHit;
        }

        // L2: Check IndexedDB
        await this.init();
        if (!this.db) return null;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const result = request.result as CachedSidebar | undefined;
                if (result) {
                    // Promote to memory cache
                    this.memoryCache.set(key, result.documents);
                    console.log(`[SidebarCache] IndexedDB hit: ${key}, ${result.documents.length} docs`);
                    resolve(result.documents);
                } else {
                    resolve(null);
                }
            };
        });
    }

    async set(parentId: string, documents: any[]): Promise<void> {
        const key = parentId || "root";

        // L1: Update memory cache immediately
        this.memoryCache.set(key, documents);

        // L2: Persist to IndexedDB
        await this.init();
        if (!this.db) return;

        const entry: CachedSidebar = {
            parentId: key,
            documents,
            timestamp: Date.now(),
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(entry);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                console.log(`[SidebarCache] Saved: ${key}, ${documents.length} docs`);
                resolve();
            };
        });
    }

    async invalidate(parentId?: string): Promise<void> {
        const key = parentId || "root";
        this.memoryCache.delete(key);

        await this.init();
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async clear(): Promise<void> {
        this.memoryCache.clear();

        await this.init();
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }
}

export const sidebarCache = new SidebarCache();

// Make available in browser console for debugging
if (typeof window !== "undefined") {
    (window as any).__SIDEBAR_CACHE__ = sidebarCache;
}
