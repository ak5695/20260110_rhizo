import { useState, useEffect, useCallback } from "react";
import { getDocumentBindings } from "@/actions/canvas-bindings";
import { bindingCache } from "@/lib/cache/binding-cache";
import { useBindingStore } from "@/store/use-binding-store";

/**
 * Sync bindings with cache-first strategy
 */
export function useBindingSync(documentId: string) {
    const [isLoading, setIsLoading] = useState(true);
    const setBindings = useBindingStore((state) => state.setBindings);
    const bindings = useBindingStore((state) => state.bindings);

    // Unified sync logic
    const sync = useCallback(async (options: { skipCache?: boolean, delayServer?: boolean } = {}) => {
        if (!documentId) return;

        // 1. Cache Load (Immediate, unless skipped)
        if (!options.skipCache) {
            try {
                const cached = await bindingCache.get(documentId);
                // Check if we are still active (state update safety)
                // Note: We can't easily check "active" deep here without ref, but 
                // Zustand store updates are generally safe or idempotent.
                if (cached) {
                    console.log(`[BindingSync] Cache hit: ${cached.length} bindings`);
                    setBindings(cached);
                    setIsLoading(false);
                }
            } catch (e) {
                console.warn("[BindingSync] Cache read error", e);
            }
        }

        // 2. Server Fetch (Delayed/Debounced check happens in useEffect)
        // We define the fetcher here but invoke it later
    }, [documentId, setBindings]);

    // Manual refresh (instant server fetch)
    const refresh = useCallback(async () => {
        try {
            const result = await getDocumentBindings(documentId);
            if (result.success && result.bindings) {
                setBindings(result.bindings);
                await bindingCache.set(documentId, result.bindings);
                console.log(`[BindingSync] Refreshed: ${result.bindings.length} bindings`);
            }
        } catch (e) {
            console.error("[BindingSync] Refresh error", e);
        }
    }, [documentId, setBindings]);

    // Initial Load Effect with Debounce
    useEffect(() => {
        let isActive = true;

        // 1. Immediate Cache Load
        bindingCache.get(documentId).then(cached => {
            if (isActive && cached) {
                setBindings(cached);
                setIsLoading(false);
            }
        });

        // 2. Debounced Server Fetch
        // Wait 300ms before hitting server. If user navigates away, this cancelled.
        const timer = setTimeout(async () => {
            if (!isActive) return;

            try {
                const result = await getDocumentBindings(documentId);
                if (!isActive) return; // Ignore if stale

                if (result.success && result.bindings) {
                    setBindings(result.bindings);
                    await bindingCache.set(documentId, result.bindings);
                    console.log(`[BindingSync] Synced from server: ${result.bindings.length} bindings`);
                }
            } catch (e) {
                if (isActive) console.error("[BindingSync] Server fetch error", e);
            } finally {
                if (isActive) setIsLoading(false);
            }
        }, 300); // 300ms debounce

        return () => {
            isActive = false;
            clearTimeout(timer);
        };
    }, [documentId, setBindings]);

    // Listen for refresh events
    useEffect(() => {
        const handleRefresh = () => refresh();
        window.addEventListener("refresh-bindings", handleRefresh);
        return () => window.removeEventListener("refresh-bindings", handleRefresh);
    }, [refresh]);

    return { isLoading, bindings };
}
