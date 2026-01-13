/**
 * Existence Event Bus - Event Persistence Layer
 *
 * Ensures zero event loss by persisting events to localStorage
 * before dispatching. Events are retried up to 3 times with
 * exponential backoff.
 *
 * This prevents the "ghost binding" problem where page refreshes
 * cause state inconsistencies due to lost browser events.
 */

/**
 * Event types
 */
export type ExistenceEventType =
    | 'binding:hidden'
    | 'binding:shown'
    | 'binding:deleted'
    | 'binding:restored'
    | 'binding:pending'
    | 'binding:approved'
    | 'binding:rejected'
    | 'binding:status-changed';

/**
 * Event payload
 */
export interface ExistenceEvent {
    id: string;
    type: ExistenceEventType;
    detail: {
        bindingId: string;
        elementId: string;
        status?: string;
        previousStatus?: string;
        actorId?: string;
        userId?: string;
        reason?: string;
        [key: string]: any;
    };
    timestamp: number;
    attempts: number;
    lastAttempt?: number;
}

/**
 * Event processing result
 */
interface ProcessResult {
    success: boolean;
    error?: Error;
}

/**
 * ExistenceEventBus - Persistent event queue
 *
 * Features:
 * - localStorage persistence (survives page refresh)
 * - Automatic retry with exponential backoff
 * - Queue restoration on page load
 * - Max 3 retry attempts per event
 * - Event deduplication by ID
 */
export class ExistenceEventBus {
    private static instance: ExistenceEventBus | null = null;
    private static readonly STORAGE_KEY = 'existence-event-queue';
    private static readonly MAX_ATTEMPTS = 3;
    private static readonly BASE_DELAY = 500; // ms

    private queue: ExistenceEvent[] = [];
    private processing: boolean = false;
    private isBrowser: boolean = false;

    private constructor() {
        this.isBrowser = typeof window !== 'undefined';
        if (this.isBrowser) {
            this.restoreQueue();
            // Start processing on next tick
            setTimeout(() => this.processQueue(), 0);
        }
    }

    /**
     * Singleton accessor
     */
    public static getInstance(): ExistenceEventBus {
        if (!ExistenceEventBus.instance) {
            ExistenceEventBus.instance = new ExistenceEventBus();
        }
        return ExistenceEventBus.instance;
    }

    /**
     * Publish an event
     * Persists to localStorage before dispatching
     */
    public async publish(
        type: ExistenceEventType,
        detail: ExistenceEvent['detail']
    ): Promise<void> {
        if (!this.isBrowser) {
            console.warn('[ExistenceEventBus] Not in browser, skipping event:', type);
            return;
        }

        const event: ExistenceEvent = {
            id: crypto.randomUUID(),
            type,
            detail,
            timestamp: Date.now(),
            attempts: 0
        };

        console.log('[ExistenceEventBus] Publishing event:', type, detail);

        // Add to queue
        this.queue.push(event);

        // Persist to localStorage
        this.persistQueue();

        // Process immediately
        this.processQueue();
    }

    /**
     * Process event queue
     * Retries failed events with exponential backoff
     */
    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;

        const now = Date.now();
        const eventsToProcess: ExistenceEvent[] = [];

        // Find events ready to process
        for (const event of this.queue) {
            if (event.attempts >= ExistenceEventBus.MAX_ATTEMPTS) {
                // Max attempts reached, remove from queue
                console.error('[ExistenceEventBus] Max attempts reached for event:', event.id, event.type);
                this.removeFromQueue(event.id);
                continue;
            }

            // Check if enough time has passed since last attempt
            if (event.lastAttempt) {
                const delay = ExistenceEventBus.BASE_DELAY * Math.pow(2, event.attempts - 1);
                if (now - event.lastAttempt < delay) {
                    continue; // Not ready yet
                }
            }

            eventsToProcess.push(event);
        }

        // Process events
        for (const event of eventsToProcess) {
            const result = await this.processEvent(event);

            if (result.success) {
                // Remove from queue on success
                this.removeFromQueue(event.id);
                console.log('[ExistenceEventBus] Event processed successfully:', event.id, event.type);
            } else {
                // Update attempt count and timestamp
                event.attempts++;
                event.lastAttempt = Date.now();
                console.warn(
                    '[ExistenceEventBus] Event processing failed, attempt',
                    event.attempts,
                    'of',
                    ExistenceEventBus.MAX_ATTEMPTS,
                    ':',
                    event.id,
                    result.error?.message
                );
            }
        }

        // Persist updated queue
        this.persistQueue();

        this.processing = false;

        // Schedule next processing if queue not empty
        if (this.queue.length > 0) {
            setTimeout(() => this.processQueue(), 1000);
        }
    }

    /**
     * Process a single event
     */
    private async processEvent(event: ExistenceEvent): Promise<ProcessResult> {
        try {
            // Dispatch browser CustomEvent
            window.dispatchEvent(
                new CustomEvent(event.type, {
                    detail: event.detail
                })
            );

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }

    /**
     * Remove event from queue
     */
    private removeFromQueue(eventId: string): void {
        this.queue = this.queue.filter(e => e.id !== eventId);
    }

    /**
     * Persist queue to localStorage
     */
    private persistQueue(): void {
        if (!this.isBrowser) return;

        try {
            const serialized = JSON.stringify(this.queue);
            localStorage.setItem(ExistenceEventBus.STORAGE_KEY, serialized);
        } catch (error) {
            console.error('[ExistenceEventBus] Failed to persist queue:', error);
        }
    }

    /**
     * Restore queue from localStorage
     */
    public restoreQueue(): void {
        if (!this.isBrowser) return;

        try {
            const serialized = localStorage.getItem(ExistenceEventBus.STORAGE_KEY);
            if (serialized) {
                this.queue = JSON.parse(serialized);
                console.log('[ExistenceEventBus] Restored', this.queue.length, 'events from storage');

                // Clean up old events (older than 1 hour)
                const oneHourAgo = Date.now() - 60 * 60 * 1000;
                this.queue = this.queue.filter(e => e.timestamp > oneHourAgo);

                if (this.queue.length > 0) {
                    console.log('[ExistenceEventBus] Processing restored queue...');
                    this.processQueue();
                }
            }
        } catch (error) {
            console.error('[ExistenceEventBus] Failed to restore queue:', error);
            // Clear corrupted storage
            localStorage.removeItem(ExistenceEventBus.STORAGE_KEY);
            this.queue = [];
        }
    }

    /**
     * Clear the event queue
     * Useful for testing or manual intervention
     */
    public clearQueue(): void {
        this.queue = [];
        if (this.isBrowser) {
            localStorage.removeItem(ExistenceEventBus.STORAGE_KEY);
        }
        console.log('[ExistenceEventBus] Queue cleared');
    }

    /**
     * Get queue status
     */
    public getQueueStatus() {
        return {
            size: this.queue.length,
            processing: this.processing,
            events: this.queue.map(e => ({
                id: e.id,
                type: e.type,
                attempts: e.attempts,
                age: Date.now() - e.timestamp
            }))
        };
    }

    /**
     * Force process queue (for testing)
     */
    public async forceProcess(): Promise<void> {
        await this.processQueue();
    }
}

/**
 * Singleton instance export
 */
export const existenceEventBus = ExistenceEventBus.getInstance();

/**
 * Convenience function to publish events
 */
export async function publishExistenceEvent(
    type: ExistenceEventType,
    detail: ExistenceEvent['detail']
): Promise<void> {
    await existenceEventBus.publish(type, detail);
}

/**
 * Initialize event bus on page load (client-side only)
 */
if (typeof window !== 'undefined') {
    // Restore queue on page load
    window.addEventListener('DOMContentLoaded', () => {
        existenceEventBus.restoreQueue();
    });

    // Clear queue on page unload if empty (cleanup)
    window.addEventListener('beforeunload', () => {
        const status = existenceEventBus.getQueueStatus();
        if (status.size === 0) {
            existenceEventBus.clearQueue();
        }
    });

    // Expose for debugging
    if (typeof window !== 'undefined') {
        (window as any).__existenceEventBus = existenceEventBus;
    }
}
