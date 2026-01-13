/**
 * Canvas Cache for Instant Loading
 * 
 * Strategy: Cache-First, Background Sync
 * 1. Load from IndexedDB instantly (if available)
 * 2. Display cached data immediately
 * 3. Fetch from server in background
 * 4. Merge and update if changes detected
 */

const DB_NAME = "jotion-canvas-cache";
const DB_VERSION = 1;
const STORE_NAME = "canvases";

interface CachedCanvas {
    documentId: string;
    canvasId: string;
    elements: any[];
    viewport: {
        x: number;
        y: number;
        zoom: number;
    };
    timestamp: number;
    version: number;
}

class CanvasCache {
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void> | null = null;

    async init(): Promise<void> {
        if (typeof window === "undefined") return;
        if (this.db) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                console.log("[CanvasCache] Initialized");
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: "documentId" });
                }
            };
        });

        return this.initPromise;
    }

    async get(documentId: string): Promise<CachedCanvas | null> {
        await this.init();
        if (!this.db) return null;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(documentId);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const result = request.result as CachedCanvas | undefined;
                if (result) {
                    console.log(`[CanvasCache] Hit: ${documentId}, ${result.elements.length} elements`);
                }
                resolve(result || null);
            };
        });
    }

    async set(documentId: string, data: Omit<CachedCanvas, "documentId" | "timestamp">): Promise<void> {
        await this.init();
        if (!this.db) return;

        const entry: CachedCanvas = {
            documentId,
            ...data,
            timestamp: Date.now(),
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(entry);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                console.log(`[CanvasCache] Saved: ${documentId}, ${data.elements.length} elements`);
                resolve();
            };
        });
    }

    async remove(documentId: string): Promise<void> {
        await this.init();
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(documentId);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async clear(): Promise<void> {
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

export const canvasCache = new CanvasCache();

// Make available in browser console for debugging
if (typeof window !== "undefined") {
    (window as any).__CANVAS_CACHE__ = canvasCache;
}
