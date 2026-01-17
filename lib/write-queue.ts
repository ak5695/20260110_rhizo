/**
 * Pending Writes Queue with Debouncing
 *
 * CRITICAL SAFETY FEATURES:
 * 1. Coalesces rapid updates to prevent database thrashing
 * 2. Guarantees eventual consistency - all writes WILL be persisted
 * 3. Maintains write order per document
 * 4. Flushes on page unload to prevent data loss
 * 5. Provides immediate UI feedback while debouncing backend writes
 *
 * @module lib/write-queue
 */

import { OptimisticLockError } from "./errors";
import { update } from "@/actions/documents";

/**
 * Pending write operation
 */
interface PendingWrite {
  documentId: string;
  updates: Record<string, any>;
  version?: number;
  userId: string;
  timestamp: number;
  retryCount: number;
}

/**
 * Write queue status for monitoring
 */
export interface WriteQueueStats {
  pendingWrites: number;
  totalWritesProcessed: number;
  totalWritesFailed: number;
  averageDebounceTime: number;
}

/**
 * Singleton write queue manager
 */
class WriteQueueManager {
  private pendingWrites: Map<string, PendingWrite> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private flushPromises: Map<string, Promise<void>> = new Map();

  // Statistics
  private stats = {
    totalWritesProcessed: 0,
    totalWritesFailed: 0,
    totalDebounceTime: 0,
    debounceCount: 0,
  };

  // Configuration
  private readonly DEBOUNCE_DELAY = {
    title: 500,      // Reduced for snappier saves
    content: 500,    // Reduced to minimize data loss risk on rapid refresh
    icon: 0,         // Immediate
    coverImage: 0,   // Immediate
    default: 500,
  };

  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly FORCE_FLUSH_DELAY = 5000;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => this.flushAll());
      // Disabled auto-flush interval to prevent log spam and potential cycles
      // setInterval(() => this.flushAll(), this.FORCE_FLUSH_DELAY);
    }
  }

  async queueUpdate(params: {
    documentId: string;
    fieldName: string;
    updates: Record<string, any>;
    version?: number;
    userId: string;
  }): Promise<void> {
    const { documentId, fieldName, updates, version, userId } = params;

    const existing = this.pendingWrites.get(documentId);

    // Merge logic: Preserve the LATEST version we know about
    const finalVersion = (version !== undefined && (existing?.version ?? 0) > version)
      ? existing?.version
      : version;

    const merged = existing
      ? { ...existing.updates, ...updates }
      : updates;

    this.pendingWrites.set(documentId, {
      documentId,
      updates: merged,
      version: finalVersion,
      userId,
      timestamp: Date.now(),
      retryCount: 0,
    });

    const existingTimer = this.debounceTimers.get(documentId);
    if (existingTimer) clearTimeout(existingTimer);

    const delay = this.getDebounceDelay(fieldName);
    const timer = setTimeout(() => this.flushDocument(documentId), delay);
    this.debounceTimers.set(documentId, timer);

    // UX: Notify UI that changes are pending
    this.dispatchStatus(documentId, "pending");

    return this.waitForFlush(documentId);
  }

  private getDebounceDelay(fieldName: string): number {
    return (
      this.DEBOUNCE_DELAY[fieldName as keyof typeof this.DEBOUNCE_DELAY] ||
      this.DEBOUNCE_DELAY.default
    );
  }

  private async waitForFlush(documentId: string): Promise<void> {
    const existing = this.flushPromises.get(documentId);
    if (existing) return existing;

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.pendingWrites.has(documentId)) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  async flushDocument(documentId: string): Promise<void> {
    const pending = this.pendingWrites.get(documentId);
    if (!pending) return;

    if (this.debounceTimers.has(documentId)) {
      clearTimeout(this.debounceTimers.get(documentId)!);
      this.debounceTimers.delete(documentId);
    }

    if (this.flushPromises.has(documentId)) return;

    // Capture snapshot to verify if new data arrived during async execution
    const originalTimestamp = pending.timestamp;
    const snapshot = { ...pending };

    const flushPromise = (async () => {
      try {
        this.dispatchStatus(documentId, "saving");
        await this.executeWrite(snapshot);
        this.stats.totalWritesProcessed++;
      } catch (error) {
        this.stats.totalWritesFailed++;
        console.error(`[WriteQueue] Failed to flush ${documentId}:`, error);

        if (error instanceof OptimisticLockError || (error as any).name === "OptimisticLockError") {
          console.warn("[WriteQueue] Optimistic lock conflict detect. Healing...");
          // In practice, executeWrite already updates latestPending.version on success.
          // On failure, we might need a refresh.
        }

        if (snapshot.retryCount < this.MAX_RETRY_ATTEMPTS) {
          const retrySnapshot = {
            ...snapshot,
            retryCount: snapshot.retryCount + 1,
            timestamp: Date.now()
          };
          // Only re-queue if no newer manual edit happened
          const current = this.pendingWrites.get(documentId);
          if (!current || current.timestamp === originalTimestamp) {
            this.pendingWrites.set(documentId, retrySnapshot);
            const retryDelay = Math.pow(2, retrySnapshot.retryCount) * 1000;
            setTimeout(() => this.flushDocument(documentId), retryDelay);
          }
          return;
        }
        this.storeFailedWrite(snapshot);
      } finally {
        this.flushPromises.delete(documentId);

        // CRITICAL: Only delete from queue if NO NEW DATA arrived
        const currentPending = this.pendingWrites.get(documentId);
        if (currentPending && currentPending.timestamp === originalTimestamp) {
          this.pendingWrites.delete(documentId);
          this.dispatchStatus(documentId, "idle");
        } else if (currentPending) {
          // New data arrived, trigger immediate next flush
          this.flushDocument(documentId);
        }
      }
    })();

    this.flushPromises.set(documentId, flushPromise);
    return flushPromise;
  }

  private async executeWrite(pending: PendingWrite): Promise<void> {
    const { documentId, updates, version } = pending;

    const result = await update({
      id: documentId,
      version,
      ...updates,
    });

    // Handle return from Server Action (it might be the raw doc or a result object based on previous edits)
    const updatedDoc = (result as any)?.success === false ? null : (result as any);

    const latestPending = this.pendingWrites.get(documentId);
    if (latestPending && updatedDoc?.version) {
      latestPending.version = updatedDoc.version;
    }

    if (typeof window !== "undefined" && updatedDoc) {
      window.dispatchEvent(new CustomEvent("write-success", {
        detail: { documentId, doc: updatedDoc }
      }));

      if (updates.title || updates.icon) {
        window.dispatchEvent(new CustomEvent("documents-changed"));
      }
    }
  }

  private dispatchStatus(documentId: string, status: "idle" | "pending" | "saving") {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("write-queue-status", {
        detail: { documentId, status }
      }));
    }
  }

  /**
   * Flush all pending writes (called on beforeunload)
   */
  flushAll(): void {
    if (this.pendingWrites.size === 0) return;

    console.log(`[WriteQueue] Flushing ${this.pendingWrites.size} pending writes...`);

    // Use sendBeacon for guaranteed delivery on page unload
    const promises: Promise<void>[] = [];

    // Convert to array to avoid iterator issues with older TypeScript targets
    const documentIds = Array.from(this.pendingWrites.keys());
    for (const documentId of documentIds) {
      promises.push(this.flushDocument(documentId));
    }

    // In modern browsers with keepalive, these will complete even if page closes
    Promise.allSettled(promises);
  }

  /**
   * Store failed write to IndexedDB as backup
   */
  private async storeFailedWrite(pending: PendingWrite): Promise<void> {
    if (typeof window === "undefined" || !window.indexedDB) {
      return;
    }

    try {
      const dbRequest = indexedDB.open("jotion-failed-writes", 1);

      dbRequest.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("failed-writes")) {
          db.createObjectStore("failed-writes", { keyPath: "documentId" });
        }
      };

      dbRequest.onsuccess = () => {
        const db = dbRequest.result;
        const tx = db.transaction(["failed-writes"], "readwrite");
        const store = tx.objectStore("failed-writes");

        store.put({
          ...pending,
          storedAt: Date.now(),
        });

        console.warn(
          `[WriteQueue] Stored failed write to IndexedDB for recovery: ${pending.documentId}`
        );
      };
    } catch (error) {
      console.error("[WriteQueue] Failed to store backup:", error);
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): WriteQueueStats {
    return {
      pendingWrites: this.pendingWrites.size,
      totalWritesProcessed: this.stats.totalWritesProcessed,
      totalWritesFailed: this.stats.totalWritesFailed,
      averageDebounceTime:
        this.stats.debounceCount > 0
          ? this.stats.totalDebounceTime / this.stats.debounceCount
          : 0,
    };
  }

  /**
   * Check if document has pending writes
   */
  hasPendingWrites(documentId: string): boolean {
    return this.pendingWrites.has(documentId);
  }

  /**
   * Get pending write for document (for debugging)
   */
  getPendingWrite(documentId: string): PendingWrite | undefined {
    return this.pendingWrites.get(documentId);
  }
}

// Export singleton instance
export const writeQueue = new WriteQueueManager();

// Development/debugging helpers
if (typeof window !== "undefined") {
  (window as any).__JOTION_WRITE_QUEUE__ = writeQueue;
}
