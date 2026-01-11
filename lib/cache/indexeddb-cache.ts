/**
 * IndexedDB Cache Implementation
 * Level 2 Cache: Persistent storage for offline support
 */

const DB_NAME = "jotion-cache";
const DB_VERSION = 1;
const STORE_NAME = "documents";

interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  expiresAt: number;
}

export class IndexedDBCache<T> {
  private db: IDBDatabase | null = null;
  private ttl: number;

  constructor(ttl: number = 30 * 60 * 1000) {
    this.ttl = ttl; // Default: 30 minutes
  }

  async init(): Promise<void> {
    if (typeof window === "undefined") {
      // SSR environment - IndexedDB not available
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, {
            keyPath: "key",
          });
          objectStore.createIndex("timestamp", "timestamp", { unique: false });
          objectStore.createIndex("expiresAt", "expiresAt", { unique: false });
        }
      };
    });
  }

  async get(key: string): Promise<T | null> {
    if (!this.db) await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined;

        if (!entry) {
          resolve(null);
          return;
        }

        // Check if expired
        if (Date.now() > entry.expiresAt) {
          this.remove(key); // Clean up expired entry
          resolve(null);
          return;
        }

        resolve(entry.value);
      };
    });
  }

  async set(key: string, value: T): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.ttl,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async remove(key: string): Promise<void> {
    if (!this.db) await this.init();
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
    if (!this.db) await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  // Clean up expired entries
  async cleanupExpired(): Promise<number> {
    if (!this.db) await this.init();
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("expiresAt");
      const now = Date.now();
      const range = IDBKeyRange.upperBound(now);
      const request = index.openCursor(range);

      let count = 0;

      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          count++;
          cursor.continue();
        } else {
          resolve(count);
        }
      };
    });
  }

  // Get all keys matching a pattern
  async invalidatePattern(pattern: RegExp): Promise<number> {
    if (!this.db) await this.init();
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();

      let count = 0;

      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const entry = cursor.value as CacheEntry<T>;
          if (pattern.test(entry.key)) {
            cursor.delete();
            count++;
          }
          cursor.continue();
        } else {
          resolve(count);
        }
      };
    });
  }

  async getStats() {
    if (!this.db) await this.init();
    if (!this.db) return { count: 0, sizeEstimate: 0 };

    return new Promise<{ count: number; sizeEstimate: number }>(
      (resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.count();

        request.onerror = () => reject(request.error);
        request.onsuccess = async () => {
          const count = request.result;
          let sizeEstimate = 0;

          // Estimate storage if available
          if ("estimate" in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            sizeEstimate = estimate.usage || 0;
          }

          resolve({ count, sizeEstimate });
        };
      }
    );
  }
}
