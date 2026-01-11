/**
 * Three-Level Document Cache Manager for Neon/PostgreSQL
 *
 * CRITICAL: Read-Only Cache - All writes bypass cache and go directly to database
 *
 * Cache Levels:
 * L1: Memory (LRU, 100 docs, 5min TTL) - Fastest
 * L2: IndexedDB (persistent, 30min TTL) - Offline support
 * L3: PostgreSQL (Neon) - Source of truth
 *
 * @module lib/cache/document-cache
 */

import { LRUCache } from "./lru-cache";
import { IndexedDBCache } from "./indexeddb-cache";

// Use Drizzle schema types
type DocumentData = {
  id: string;
  title: string;
  userId: string;
  isArchived: boolean;
  parentDocumentId: string | null;
  content: string | null;
  coverImage: string | null;
  icon: string | null;
  isPublished: boolean;
  version: number;
  lastModifiedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export class DocumentCacheManager {
  private static instance: DocumentCacheManager;

  // Level 1: In-memory LRU cache (fast, volatile)
  private memoryCache: LRUCache<DocumentData>;

  // Level 2: IndexedDB cache (persistent, offline support)
  private persistentCache: IndexedDBCache<DocumentData>;

  // Level 3: Pending requests deduplication
  private pendingRequests: Map<string, Promise<DocumentData | null>>;

  private constructor() {
    // Level 1: 100 documents in memory, 5 min TTL
    this.memoryCache = new LRUCache<DocumentData>(100, 5 * 60 * 1000);

    // Level 2: IndexedDB, 30 min TTL
    this.persistentCache = new IndexedDBCache<DocumentData>(30 * 60 * 1000);

    this.pendingRequests = new Map();

    // Initialize IndexedDB
    this.init();

    // Cleanup expired entries every 5 minutes
    this.startCleanupInterval();
  }

  static getInstance(): DocumentCacheManager {
    if (!DocumentCacheManager.instance) {
      DocumentCacheManager.instance = new DocumentCacheManager();
    }
    return DocumentCacheManager.instance;
  }

  private async init() {
    await this.persistentCache.init();
  }

  private startCleanupInterval() {
    setInterval(async () => {
      await this.persistentCache.cleanupExpired();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Get document with three-level cache lookup
   * IMPORTANT: This is READ-ONLY. Writes always bypass cache.
   *
   * Level 1: Memory -> Level 2: IndexedDB -> Level 3: Fetch from database
   */
  async get(
    documentId: string,
    fetchFn: () => Promise<DocumentData | null>
  ): Promise<DocumentData | null> {
    const cacheKey = `doc:${documentId}`;

    // Level 1: Check memory cache
    const memoryResult = this.memoryCache.get(cacheKey);
    if (memoryResult) {
      console.log(`[Cache] L1 Hit: ${documentId}`);
      return memoryResult;
    }

    // Level 2: Check IndexedDB
    try {
      const persistentResult = await this.persistentCache.get(cacheKey);
      if (persistentResult) {
        console.log(`[Cache] L2 Hit: ${documentId}`);
        // Promote to memory cache
        this.memoryCache.set(cacheKey, persistentResult);
        return persistentResult;
      }
    } catch (error) {
      console.warn("[Cache] IndexedDB error:", error);
    }

    // Level 3: Deduplicate concurrent requests
    if (this.pendingRequests.has(cacheKey)) {
      console.log(`[Cache] Request deduplication: ${documentId}`);
      return this.pendingRequests.get(cacheKey)!;
    }

    // Fetch from database
    console.log(`[Cache] L3 Miss, fetching from DB: ${documentId}`);
    const fetchPromise = fetchFn().then((data) => {
      if (data) {
        this.set(documentId, data);
      }
      this.pendingRequests.delete(cacheKey);
      return data;
    });

    this.pendingRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Set document in READ caches only
   * CRITICAL: This does NOT write to database. Only updates cache.
   */
  set(documentId: string, data: DocumentData): void {
    const cacheKey = `doc:${documentId}`;

    // Level 1: Memory cache
    this.memoryCache.set(cacheKey, data);

    // Level 2: IndexedDB (async, non-blocking)
    this.persistentCache.set(cacheKey, data).catch((error) => {
      console.warn("[Cache] Failed to persist to IndexedDB:", error);
    });
  }

  /**
   * Invalidate document from all cache levels
   * CRITICAL: Call this after ANY database write to ensure consistency
   */
  async invalidate(documentId: string): Promise<void> {
    const cacheKey = `doc:${documentId}`;

    // Remove from memory
    this.memoryCache.remove(cacheKey);

    // Remove from IndexedDB
    await this.persistentCache.remove(cacheKey);

    // Remove from pending requests
    this.pendingRequests.delete(cacheKey);

    console.log(`[Cache] Invalidated: ${documentId}`);
  }

  /**
   * Invalidate all documents (e.g., after logout)
   */
  async invalidateAll(): Promise<void> {
    this.memoryCache.clear();
    await this.persistentCache.clear();
    this.pendingRequests.clear();
    console.log("[Cache] Cleared all caches");
  }

  /**
   * Invalidate documents matching a pattern
   */
  async invalidatePattern(pattern: RegExp): Promise<void> {
    this.memoryCache.invalidatePattern(pattern);
    await this.persistentCache.invalidatePattern(pattern);
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    const memoryStats = this.memoryCache.getStats();
    const indexedDBStats = await this.persistentCache.getStats();

    return {
      memory: memoryStats,
      indexedDB: indexedDBStats,
      pendingRequests: this.pendingRequests.size,
    };
  }
}

// Export singleton instance
export const documentCache = DocumentCacheManager.getInstance();

// Make available in browser console for debugging
if (typeof window !== "undefined") {
  (window as any).__JOTION_CACHE__ = {
    getStats: () => documentCache.getStats(),
    clear: () => documentCache.invalidateAll(),
    invalidate: (id: string) => documentCache.invalidate(id),
  };
}
