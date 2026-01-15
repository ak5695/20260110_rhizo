/**
 * Existence Arbitration System (EAS) - Core Engine
 *
 * Philosophy: "对象不是被删除的，它们是被判定为不存在的"
 * (Objects are not deleted, they are judged to not exist)
 *
 * This engine treats existence as a state judgment rather than physical deletion.
 * BindingEntity.currentStatus is the single source of truth.
 * Canvas nodes and Document marks are merely projections of this truth.
 *
 * IMPORTANT: This module must run server-side only due to database access.
 */

import 'server-only';

import { EventEmitter } from 'events';
import { db } from '@/db';
import {
    documentCanvasBindings,
    bindingStatusLog,
    bindingInconsistencies,
    bindingExistenceCache,
    canvasElements
} from '@/db/canvas-schema';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * Status types for binding existence
 */
export type BindingStatus = 'visible' | 'hidden' | 'deleted' | 'pending';

/**
 * Actor types for audit trail
 */
export type ActorType = 'user' | 'system' | 'ai';

/**
 * Transition types for state changes
 */
export type TransitionType =
    | 'user_hide'
    | 'user_delete'
    | 'user_restore'
    | 'user_show'
    | 'system_reconcile'
    | 'arbitration_approve'
    | 'arbitration_reject';

/**
 * Inconsistency types for conflict detection
 */
export type InconsistencyType =
    | 'orphaned'
    | 'missing-element'
    | 'missing-mark'
    | 'status-mismatch'
    | 'ghost-binding';

/**
 * Inconsistency detection result
 */
export interface Inconsistency {
    id: string;
    bindingId: string;
    type: InconsistencyType;
    bindingStatus: BindingStatus;
    elementDeleted: boolean | null;
    suggestedResolution: string;
    resolutionConfidence: number;
    snapshot: any;
}

/**
 * Reconciliation result
 */
export interface ReconcileResult {
    autoFixed: number;
    requiresHumanReview: number;
    inconsistencies: Inconsistency[];
}

/**
 * Binding cache entry
 */
interface BindingCacheEntry {
    id: string;
    status: BindingStatus;
    elementId: string;
    canvasId: string;
    blockId: string;
    documentId: string;
}

/**
 * Event payload for binding events
 */
interface BindingEventDetail {
    bindingId: string;
    elementId: string;
    status: BindingStatus;
    previousStatus?: BindingStatus;
    actorId?: string;
}

/**
 * ExistenceEngine - Core arbitration engine
 *
 * Responsibilities:
 * - Maintain O(1) memory indexes for fast queries
 * - Enforce idempotent state transitions
 * - Emit dual-channel events (Node + Browser)
 * - Detect and resolve inconsistencies
 * - Provide human arbitration interface
 */
export class ExistenceEngine extends EventEmitter {
    private static instance: ExistenceEngine | null = null;

    // O(1) memory indexes
    private statusMap: Map<string, BindingStatus> = new Map();
    private elementIdMap: Map<string, string> = new Map(); // elementId -> bindingId
    private blockIdMap: Map<string, Set<string>> = new Map(); // blockId -> Set<bindingId>
    private bindingCache: Map<string, BindingCacheEntry> = new Map();

    private initialized: boolean = false;
    private currentCanvasId: string | null = null;

    private constructor() {
        super();
        this.setMaxListeners(100); // Support multiple listeners
    }

    /**
     * Singleton accessor
     */
    public static getInstance(): ExistenceEngine {
        if (!ExistenceEngine.instance) {
            ExistenceEngine.instance = new ExistenceEngine();
        }
        return ExistenceEngine.instance;
    }

    /**
     * Initialize engine for a specific canvas
     * Loads bindings into memory for O(1) access
     */
    public async initialize(canvasId: string): Promise<void> {
        console.log('[ExistenceEngine] Initializing for canvas:', canvasId);

        this.currentCanvasId = canvasId;

        // Load all bindings for this canvas
        const bindings = await db
            .select()
            .from(documentCanvasBindings)
            .where(eq(documentCanvasBindings.canvasId, canvasId));

        // Build memory indexes
        this.statusMap.clear();
        this.elementIdMap.clear();
        this.blockIdMap.clear();
        this.bindingCache.clear();

        for (const binding of bindings) {
            const status = binding.currentStatus as BindingStatus;

            if (!binding.elementId) continue;

            this.statusMap.set(binding.id, status);
            this.elementIdMap.set(binding.elementId, binding.id);

            // blockId mapping
            if (binding.blockId) {
                const blockIdSet = this.blockIdMap.get(binding.blockId) || new Set();
                blockIdSet.add(binding.id);
                this.blockIdMap.set(binding.blockId, blockIdSet);
            }

            // Full cache entry
            this.bindingCache.set(binding.id, {
                id: binding.id,
                status,
                elementId: binding.elementId,
                canvasId: binding.canvasId,
                blockId: binding.blockId || '',
                documentId: binding.documentId
            });
        }

        this.initialized = true;
        console.log('[ExistenceEngine] Initialized with', bindings.length, 'bindings');
    }

    /**
     * Core state transition logic
     * - Atomic database update
     * - Memory index update
     * - Event emission (dual-channel)
     * - Audit log creation
     */
    private async transitionStatus(
        bindingId: string,
        newStatus: BindingStatus,
        transitionType: TransitionType,
        actorId?: string,
        actorType: ActorType = 'user',
        reason?: string
    ): Promise<void> {
        const previousStatus = this.statusMap.get(bindingId);

        if (!previousStatus) {
            throw new Error(`[ExistenceEngine] Binding ${bindingId} not found in cache`);
        }

        // Idempotent: skip if already in target status
        if (previousStatus === newStatus) {
            console.log(`[ExistenceEngine] Binding ${bindingId} already ${newStatus}, skipping`);
            return;
        }

        console.log(`[ExistenceEngine] Transition: ${bindingId} ${previousStatus} -> ${newStatus}`);

        // Database update (atomic)
        await db
            .update(documentCanvasBindings)
            .set({
                currentStatus: newStatus,
                statusUpdatedAt: new Date(),
                statusUpdatedBy: actorId || null,
                updatedAt: new Date()
            })
            .where(eq(documentCanvasBindings.id, bindingId));

        // Create audit log
        await db
            .insert(bindingStatusLog)
            .values({
                bindingId,
                status: newStatus,
                previousStatus,
                transitionType,
                transitionReason: reason || null,
                actorId: actorId || null,
                actorType,
                metadata: {
                    timestamp: new Date().toISOString(),
                    source: 'existence-engine'
                }
            });

        // Update cache
        await this.updateCache(bindingId, newStatus);

        // Update memory index
        this.statusMap.set(bindingId, newStatus);
        const cacheEntry = this.bindingCache.get(bindingId);
        if (cacheEntry) {
            cacheEntry.status = newStatus;
        }

        // Emit events (dual-channel)
        this.emitStatusChange(bindingId, newStatus, previousStatus, actorId);
    }

    /**
     * Update existence cache for performance
     */
    private async updateCache(bindingId: string, status: BindingStatus): Promise<void> {
        const existing = await db
            .select()
            .from(bindingExistenceCache)
            .where(eq(bindingExistenceCache.bindingId, bindingId))
            .limit(1);

        if (existing.length > 0) {
            await db
                .update(bindingExistenceCache)
                .set({
                    status,
                    lastVerifiedAt: new Date(),
                    cacheVersion: existing[0].cacheVersion + 1,
                    isStale: false
                })
                .where(eq(bindingExistenceCache.bindingId, bindingId));
        } else {
            await db
                .insert(bindingExistenceCache)
                .values({
                    bindingId,
                    status,
                    elementExists: true,
                    elementDeleted: status === 'hidden' || status === 'deleted',
                    markExists: status === 'visible',
                    lastVerifiedAt: new Date(),
                    cacheVersion: 1,
                    isStale: false
                });
        }
    }

    /**
     * Emit status change events
     * Dual-channel: Node EventEmitter + Browser CustomEvent
     */
    private emitStatusChange(
        bindingId: string,
        status: BindingStatus,
        previousStatus: BindingStatus,
        actorId?: string
    ): void {
        const cacheEntry = this.bindingCache.get(bindingId);
        if (!cacheEntry) return;

        const detail: BindingEventDetail = {
            bindingId,
            elementId: cacheEntry.elementId,
            status,
            previousStatus,
            actorId
        };

        // Node EventEmitter (for server-side listeners)
        this.emit('status-changed', detail);

        // Browser CustomEvent (for client-side listeners)
        if (typeof window !== 'undefined') {
            // General event
            window.dispatchEvent(new CustomEvent('binding:status-changed', { detail }));

            // Specific events
            if (status === 'hidden') {
                window.dispatchEvent(new CustomEvent('binding:hidden', { detail }));
            } else if (status === 'visible' && previousStatus !== 'visible') {
                window.dispatchEvent(new CustomEvent('binding:shown', { detail }));
            } else if (status === 'deleted') {
                window.dispatchEvent(new CustomEvent('binding:deleted', { detail }));
            } else if (status === 'pending') {
                window.dispatchEvent(new CustomEvent('binding:pending', { detail }));
            }
        }

        console.log('[ExistenceEngine] Emitted event:', status, detail);
    }

    /**
     * Hide a binding (soft delete)
     * Idempotent operation
     */
    public async hide(bindingId: string, actorId?: string): Promise<void> {
        await this.transitionStatus(
            bindingId,
            'hidden',
            'user_hide',
            actorId,
            'user',
            'User hid binding'
        );
    }

    /**
     * Show a binding (restore to visible)
     * Idempotent operation
     */
    public async show(bindingId: string, actorId?: string): Promise<void> {
        await this.transitionStatus(
            bindingId,
            'visible',
            'user_show',
            actorId,
            'user',
            'User showed binding'
        );
    }

    /**
     * Soft delete a binding
     * Idempotent operation
     */
    public async softDelete(bindingId: string, actorId?: string): Promise<void> {
        await this.transitionStatus(
            bindingId,
            'deleted',
            'user_delete',
            actorId,
            'user',
            'User deleted binding'
        );
    }

    /**
     * Restore a binding from deleted state
     * Idempotent operation
     */
    public async restore(bindingId: string, actorId?: string): Promise<void> {
        await this.transitionStatus(
            bindingId,
            'visible',
            'user_restore',
            actorId,
            'user',
            'User restored binding'
        );
    }

    /**
     * Hide multiple bindings (batch operation)
     */
    public async hideMany(bindingIds: string[], actorId?: string): Promise<void> {
        for (const bindingId of bindingIds) {
            try {
                await this.hide(bindingId, actorId);
            } catch (error) {
                console.error('[ExistenceEngine] Failed to hide binding:', bindingId, error);
            }
        }
    }

    /**
     * Show multiple bindings (batch operation)
     */
    public async showMany(bindingIds: string[], actorId?: string): Promise<void> {
        for (const bindingId of bindingIds) {
            try {
                await this.show(bindingId, actorId);
            } catch (error) {
                console.error('[ExistenceEngine] Failed to show binding:', bindingId, error);
            }
        }
    }

    /**
     * Hide bindings by element IDs
     * Returns count of hidden bindings
     */
    public async hideByElementIds(elementIds: string[], actorId?: string): Promise<number> {
        let count = 0;

        for (const elementId of elementIds) {
            const bindingId = this.elementIdMap.get(elementId);
            if (bindingId) {
                try {
                    await this.hide(bindingId, actorId);
                    count++;
                } catch (error) {
                    console.error('[ExistenceEngine] Failed to hide binding for element:', elementId, error);
                }
            }
        }

        return count;
    }

    /**
     * Show bindings by element IDs
     * Returns count of shown bindings
     */
    public async showByElementIds(elementIds: string[], actorId?: string): Promise<number> {
        let count = 0;

        for (const elementId of elementIds) {
            const bindingId = this.elementIdMap.get(elementId);
            if (bindingId) {
                try {
                    await this.show(bindingId, actorId);
                    count++;
                } catch (error) {
                    console.error('[ExistenceEngine] Failed to show binding for element:', elementId, error);
                }
            }
        }

        return count;
    }

    /**
     * Register a new binding in the engine (called after creation)
     * Updates internal maps and cache to reflect the new state
     */
    public async registerBinding(binding: any): Promise<void> {
        console.log('[ExistenceEngine] Registering new binding:', binding.id);

        if (this.currentCanvasId !== binding.canvasId) {
            console.log('[ExistenceEngine] Skipping registration for non-active canvas binding');
            return;
        }

        const status = (binding.currentStatus || 'visible') as BindingStatus;

        this.statusMap.set(binding.id, status);
        this.elementIdMap.set(binding.elementId, binding.id);

        if (binding.blockId) {
            const blockIdSet = this.blockIdMap.get(binding.blockId) || new Set();
            blockIdSet.add(binding.id);
            this.blockIdMap.set(binding.blockId, blockIdSet);
        }

        // Full cache entry
        this.bindingCache.set(binding.id, {
            id: binding.id,
            status,
            elementId: binding.elementId,
            canvasId: binding.canvasId,
            blockId: binding.blockId || '',
            documentId: binding.documentId
        });

        // Update DB Cache
        await this.updateCache(binding.id, status);

        console.log('[ExistenceEngine] Registered binding:', binding.id);
    }

    /**
     * Get status of a binding (O(1))
     */
    public getStatus(bindingId: string): BindingStatus | undefined {
        return this.statusMap.get(bindingId);
    }

    /**
     * Get all bindings by status (O(n))
     */
    public getBindingsByStatus(status: BindingStatus): string[] {
        const result: string[] = [];
        this.statusMap.forEach((bindingStatus, bindingId) => {
            if (bindingStatus === status) {
                result.push(bindingId);
            }
        });
        return result;
    }

    /**
     * Get binding by element ID (O(1))
     */
    public getBindingByElementId(elementId: string): string | undefined {
        return this.elementIdMap.get(elementId);
    }

    /**
     * Get bindings by block ID (O(1))
     */
    public getBindingsByBlockId(blockId: string): string[] {
        const bindingIds = this.blockIdMap.get(blockId);
        return bindingIds ? Array.from(bindingIds) : [];
    }

    /**
     * Detect inconsistencies in the binding system
     */
    public async detectInconsistencies(canvasId: string): Promise<Inconsistency[]> {
        console.log('[ExistenceEngine] Detecting inconsistencies for canvas:', canvasId);

        const inconsistencies: Inconsistency[] = [];

        // Get all bindings for this canvas
        const bindings = await db
            .select()
            .from(documentCanvasBindings)
            .where(eq(documentCanvasBindings.canvasId, canvasId));

        // Get all elements for this canvas
        const elements = await db
            .select()
            .from(canvasElements)
            .where(eq(canvasElements.canvasId, canvasId));

        const elementMap = new Map(elements.map(el => [el.id, el]));

        for (const binding of bindings) {
            const element = binding.elementId ? elementMap.get(binding.elementId) : undefined;
            const bindingStatus = binding.currentStatus as BindingStatus;

            // Case 1: Binding visible but element deleted
            if (bindingStatus === 'visible' && element?.isDeleted) {
                inconsistencies.push({
                    id: crypto.randomUUID(),
                    bindingId: binding.id,
                    type: 'status-mismatch',
                    bindingStatus,
                    elementDeleted: true,
                    suggestedResolution: 'update-status',
                    resolutionConfidence: 0.95,
                    snapshot: { binding, element }
                });
            }

            // Case 2: Binding hidden but element not deleted
            if (bindingStatus === 'hidden' && element && !element.isDeleted) {
                inconsistencies.push({
                    id: crypto.randomUUID(),
                    bindingId: binding.id,
                    type: 'status-mismatch',
                    bindingStatus,
                    elementDeleted: false,
                    suggestedResolution: 'update-status',
                    resolutionConfidence: 0.85,
                    snapshot: { binding, element }
                });
            }

            // Case 3: Binding exists but element missing
            if (!element) {
                inconsistencies.push({
                    id: crypto.randomUUID(),
                    bindingId: binding.id,
                    type: 'missing-element',
                    bindingStatus,
                    elementDeleted: null,
                    suggestedResolution: 'delete-binding',
                    resolutionConfidence: 0.9,
                    snapshot: { binding }
                });
            }
        }

        console.log('[ExistenceEngine] Detected', inconsistencies.length, 'inconsistencies');
        return inconsistencies;
    }

    /**
     * Reconcile inconsistencies
     * @param canvasId Canvas ID to reconcile
     * @param autoFix Whether to automatically fix high-confidence issues
     */
    public async reconcile(canvasId: string, autoFix: boolean = false): Promise<ReconcileResult> {
        console.log('[ExistenceEngine] Reconciling canvas:', canvasId, 'autoFix:', autoFix);

        const inconsistencies = await this.detectInconsistencies(canvasId);
        let autoFixed = 0;
        let requiresHumanReview = 0;

        for (const inconsistency of inconsistencies) {
            // Record inconsistency
            await db.insert(bindingInconsistencies).values({
                bindingId: inconsistency.bindingId,
                type: inconsistency.type,
                detectedBy: 'reconciliation',
                bindingStatus: inconsistency.bindingStatus,
                elementDeleted: inconsistency.elementDeleted,
                suggestedResolution: inconsistency.suggestedResolution,
                resolutionConfidence: inconsistency.resolutionConfidence,
                snapshot: inconsistency.snapshot
            });

            // Auto-fix high-confidence issues
            if (autoFix && inconsistency.resolutionConfidence >= 0.9) {
                try {
                    if (inconsistency.suggestedResolution === 'update-status') {
                        if (inconsistency.elementDeleted) {
                            await this.transitionStatus(
                                inconsistency.bindingId,
                                'hidden',
                                'system_reconcile',
                                undefined,
                                'system',
                                'Auto-fix: element deleted'
                            );
                        } else {
                            await this.transitionStatus(
                                inconsistency.bindingId,
                                'visible',
                                'system_reconcile',
                                undefined,
                                'system',
                                'Auto-fix: element restored'
                            );
                        }
                        autoFixed++;
                    } else if (inconsistency.suggestedResolution === 'delete-binding') {
                        await this.softDelete(inconsistency.bindingId);
                        autoFixed++;
                    }
                } catch (error) {
                    console.error('[ExistenceEngine] Auto-fix failed:', error);
                    requiresHumanReview++;
                }
            } else if (inconsistency.resolutionConfidence < 0.9) {
                // Low confidence: demote to pending for human review
                await this.transitionStatus(
                    inconsistency.bindingId,
                    'pending',
                    'system_reconcile',
                    undefined,
                    'system',
                    'Low confidence, requires human review'
                );
                requiresHumanReview++;
            }
        }

        console.log('[ExistenceEngine] Reconciliation complete:', {
            autoFixed,
            requiresHumanReview,
            total: inconsistencies.length
        });

        return {
            autoFixed,
            requiresHumanReview,
            inconsistencies
        };
    }

    /**
     * Human approval of pending binding
     */
    public async approve(bindingId: string, userId: string): Promise<void> {
        console.log('[ExistenceEngine] Approving binding:', bindingId, 'by user:', userId);

        await this.transitionStatus(
            bindingId,
            'visible',
            'arbitration_approve',
            userId,
            'user',
            'Human approved binding'
        );

        // Mark inconsistency as resolved
        await db
            .update(bindingInconsistencies)
            .set({
                resolvedAt: new Date(),
                resolvedBy: userId,
                resolutionAction: 'approved',
                resolutionNotes: 'Binding approved by human arbitration'
            })
            .where(eq(bindingInconsistencies.bindingId, bindingId));

        // Emit approval event
        if (typeof window !== 'undefined') {
            const cacheEntry = this.bindingCache.get(bindingId);
            if (cacheEntry) {
                window.dispatchEvent(new CustomEvent('binding:approved', {
                    detail: {
                        bindingId,
                        elementId: cacheEntry.elementId,
                        userId
                    }
                }));
            }
        }
    }

    /**
     * Human rejection of pending binding
     */
    public async reject(bindingId: string, userId: string, reason: string): Promise<void> {
        console.log('[ExistenceEngine] Rejecting binding:', bindingId, 'by user:', userId);

        await this.transitionStatus(
            bindingId,
            'deleted',
            'arbitration_reject',
            userId,
            'user',
            `Human rejected binding: ${reason}`
        );

        // Mark inconsistency as resolved
        await db
            .update(bindingInconsistencies)
            .set({
                resolvedAt: new Date(),
                resolvedBy: userId,
                resolutionAction: 'rejected',
                resolutionNotes: reason
            })
            .where(eq(bindingInconsistencies.bindingId, bindingId));

        // Emit rejection event
        if (typeof window !== 'undefined') {
            const cacheEntry = this.bindingCache.get(bindingId);
            if (cacheEntry) {
                window.dispatchEvent(new CustomEvent('binding:rejected', {
                    detail: {
                        bindingId,
                        elementId: cacheEntry.elementId,
                        userId,
                        reason
                    }
                }));
            }
        }
    }

    /**
     * Get engine status
     */
    public getEngineStatus() {
        return {
            initialized: this.initialized,
            currentCanvasId: this.currentCanvasId,
            cachedBindings: this.bindingCache.size,
            statusMapSize: this.statusMap.size,
            elementMapSize: this.elementIdMap.size,
            blockMapSize: this.blockIdMap.size
        };
    }
}

/**
 * Singleton instance export
 */
export const existenceEngine = ExistenceEngine.getInstance();
