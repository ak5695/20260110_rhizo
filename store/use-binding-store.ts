/**
 * Client-side Binding Store - Optimistic UI for instant sync
 * 
 * Philosophy: "先更新UI，后持久化"
 * Update UI immediately, persist to server in background
 */

import { create } from 'zustand';

export type BindingStatus = 'visible' | 'hidden' | 'deleted' | 'pending';

export interface ClientBinding {
    id: string;
    elementId: string;
    blockId: string;
    canvasId: string;
    documentId: string;
    status: BindingStatus;
    anchorText?: string;
    // Sync state
    isDirty: boolean; // Needs sync to server
    lastSyncedAt?: number;
}

interface BindingStore {
    // State
    bindings: Map<string, ClientBinding>;
    elementToBinding: Map<string, string>; // elementId -> bindingId (O(1) lookup)
    blockToBindings: Map<string, Set<string>>; // blockId -> Set<bindingId>
    initialized: boolean;
    currentCanvasId: string | null;

    // Pending sync queue
    pendingSyncQueue: Set<string>;
    syncInProgress: boolean;

    // Actions
    initialize: (canvasId: string, bindings: any[]) => void;

    // Optimistic updates (instant)
    hideByElementId: (elementId: string) => void;
    hideByElementIds: (elementIds: string[]) => void;
    showByElementId: (elementId: string) => void;
    registerBinding: (binding: any) => void;

    // Getters
    getBindingByElementId: (elementId: string) => ClientBinding | undefined;
    getBindingsByBlockId: (blockId: string) => ClientBinding[];
    getVisibleBindings: () => ClientBinding[];

    // Sync
    flushToServer: () => Promise<void>;
    markSynced: (bindingIds: string[]) => void;
}

export const useBindingStore = create<BindingStore>((set, get) => ({
    bindings: new Map(),
    elementToBinding: new Map(),
    blockToBindings: new Map(),
    initialized: false,
    currentCanvasId: null,
    pendingSyncQueue: new Set(),
    syncInProgress: false,

    initialize: (canvasId, serverBindings) => {
        const bindings = new Map<string, ClientBinding>();
        const elementToBinding = new Map<string, string>();
        const blockToBindings = new Map<string, Set<string>>();

        for (const b of serverBindings) {
            const status = (b.currentStatus || 'visible') as BindingStatus;

            // Skip already deleted bindings
            if (status === 'deleted') continue;

            const clientBinding: ClientBinding = {
                id: b.id,
                elementId: b.elementId,
                blockId: b.blockId || '',
                canvasId: b.canvasId,
                documentId: b.documentId,
                status,
                anchorText: b.anchorText,
                isDirty: false,
                lastSyncedAt: Date.now(),
            };

            bindings.set(b.id, clientBinding);
            elementToBinding.set(b.elementId, b.id);

            if (b.blockId) {
                const blockSet = blockToBindings.get(b.blockId) || new Set();
                blockSet.add(b.id);
                blockToBindings.set(b.blockId, blockSet);
            }
        }

        set({
            bindings,
            elementToBinding,
            blockToBindings,
            initialized: true,
            currentCanvasId: canvasId,
            pendingSyncQueue: new Set(),
        });

        console.log('[BindingStore] Initialized with', bindings.size, 'bindings');
    },

    hideByElementId: (elementId) => {
        const state = get();
        const bindingId = state.elementToBinding.get(elementId);
        if (!bindingId) return;

        const binding = state.bindings.get(bindingId);
        if (!binding || binding.status === 'hidden') return;

        // Optimistic update
        const updatedBinding = { ...binding, status: 'hidden' as BindingStatus, isDirty: true };
        const newBindings = new Map(state.bindings);
        newBindings.set(bindingId, updatedBinding);

        const newPendingQueue = new Set(state.pendingSyncQueue);
        newPendingQueue.add(bindingId);

        set({ bindings: newBindings, pendingSyncQueue: newPendingQueue });

        // Emit event for UI update (Document marks)
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('binding:hidden', {
                detail: { bindingId, elementId, blockId: binding.blockId }
            }));
        }

        console.log('[BindingStore] Hidden binding:', bindingId, 'for element:', elementId);
    },

    hideByElementIds: (elementIds) => {
        const state = get();
        const newBindings = new Map(state.bindings);
        const newPendingQueue = new Set(state.pendingSyncQueue);
        const events: Array<{ bindingId: string; elementId: string; blockId: string }> = [];

        for (const elementId of elementIds) {
            const bindingId = state.elementToBinding.get(elementId);
            if (!bindingId) continue;

            const binding = state.bindings.get(bindingId);
            if (!binding || binding.status === 'hidden') continue;

            const updatedBinding = { ...binding, status: 'hidden' as BindingStatus, isDirty: true };
            newBindings.set(bindingId, updatedBinding);
            newPendingQueue.add(bindingId);

            events.push({ bindingId, elementId, blockId: binding.blockId });
        }

        if (events.length > 0) {
            set({ bindings: newBindings, pendingSyncQueue: newPendingQueue });

            // Batch emit events
            if (typeof window !== 'undefined') {
                for (const evt of events) {
                    window.dispatchEvent(new CustomEvent('binding:hidden', { detail: evt }));
                }
            }

            console.log('[BindingStore] Hidden', events.length, 'bindings');
        }
    },

    showByElementId: (elementId) => {
        const state = get();
        const bindingId = state.elementToBinding.get(elementId);
        if (!bindingId) return;

        const binding = state.bindings.get(bindingId);
        if (!binding || binding.status === 'visible') return;

        const updatedBinding = { ...binding, status: 'visible' as BindingStatus, isDirty: true };
        const newBindings = new Map(state.bindings);
        newBindings.set(bindingId, updatedBinding);

        const newPendingQueue = new Set(state.pendingSyncQueue);
        newPendingQueue.add(bindingId);

        set({ bindings: newBindings, pendingSyncQueue: newPendingQueue });

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('binding:shown', {
                detail: { bindingId, elementId, blockId: binding.blockId }
            }));
        }

        console.log('[BindingStore] Shown binding:', bindingId, 'for element:', elementId);
    },

    registerBinding: (binding) => {
        const state = get();

        if (state.currentCanvasId !== binding.canvasId) return;

        const status = (binding.currentStatus || 'visible') as BindingStatus;
        const clientBinding: ClientBinding = {
            id: binding.id,
            elementId: binding.elementId,
            blockId: binding.blockId || '',
            canvasId: binding.canvasId,
            documentId: binding.documentId,
            status,
            anchorText: binding.anchorText,
            isDirty: false,
            lastSyncedAt: Date.now(),
        };

        const newBindings = new Map(state.bindings);
        newBindings.set(binding.id, clientBinding);

        const newElementToBinding = new Map(state.elementToBinding);
        newElementToBinding.set(binding.elementId, binding.id);

        const newBlockToBindings = new Map(state.blockToBindings);
        if (binding.blockId) {
            const blockSet = newBlockToBindings.get(binding.blockId) || new Set();
            blockSet.add(binding.id);
            newBlockToBindings.set(binding.blockId, blockSet);
        }

        set({
            bindings: newBindings,
            elementToBinding: newElementToBinding,
            blockToBindings: newBlockToBindings,
        });

        console.log('[BindingStore] Registered binding:', binding.id);
    },

    getBindingByElementId: (elementId) => {
        const state = get();
        const bindingId = state.elementToBinding.get(elementId);
        return bindingId ? state.bindings.get(bindingId) : undefined;
    },

    getBindingsByBlockId: (blockId) => {
        const state = get();
        const bindingIds = state.blockToBindings.get(blockId);
        if (!bindingIds) return [];
        return Array.from(bindingIds)
            .map(id => state.bindings.get(id))
            .filter((b): b is ClientBinding => b !== undefined);
    },

    getVisibleBindings: () => {
        const state = get();
        return Array.from(state.bindings.values()).filter(b => b.status === 'visible');
    },

    flushToServer: async () => {
        const state = get();
        if (state.syncInProgress || state.pendingSyncQueue.size === 0) return;

        set({ syncInProgress: true });

        const toSync = Array.from(state.pendingSyncQueue);
        const updates: Array<{ bindingId: string; status: BindingStatus }> = [];

        for (const bindingId of toSync) {
            const binding = state.bindings.get(bindingId);
            if (binding && binding.isDirty) {
                updates.push({ bindingId, status: binding.status });
            }
        }

        if (updates.length === 0) {
            set({ syncInProgress: false });
            return;
        }

        try {
            // Batch update to server
            const { batchUpdateBindingStatus } = await import('@/actions/canvas-bindings');
            const result = await batchUpdateBindingStatus(updates);

            if (result.success) {
                get().markSynced(toSync);
                console.log('[BindingStore] Synced', updates.length, 'bindings to server');
            } else {
                console.error('[BindingStore] Sync failed:', result.error);
            }
        } catch (error) {
            console.error('[BindingStore] Sync error:', error);
        } finally {
            set({ syncInProgress: false });
        }
    },

    markSynced: (bindingIds) => {
        const state = get();
        const newBindings = new Map(state.bindings);
        const newPendingQueue = new Set(state.pendingSyncQueue);

        for (const id of bindingIds) {
            const binding = newBindings.get(id);
            if (binding) {
                newBindings.set(id, { ...binding, isDirty: false, lastSyncedAt: Date.now() });
            }
            newPendingQueue.delete(id);
        }

        set({ bindings: newBindings, pendingSyncQueue: newPendingQueue });
    },
}));

// Auto-flush dirty bindings every 2 seconds
if (typeof window !== 'undefined') {
    setInterval(() => {
        useBindingStore.getState().flushToServer();
    }, 2000);
}
