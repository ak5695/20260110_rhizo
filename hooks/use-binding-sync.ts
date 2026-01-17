import { useState, useEffect, useCallback, useRef } from "react";
import { getDocumentBindings } from "@/actions/canvas-bindings";
import { bindingCache } from "@/lib/cache/binding-cache";
import { useBindingStore } from "@/store/use-binding-store";

/**
 * Sync bindings with cache-first strategy
 * 
 * Optimized to prevent redundant updates which can cause editor focus loss.
 */
export function useBindingSync(documentId: string) {
    const [isLoading, setIsLoading] = useState(true);
    const setBindings = useBindingStore((state) => state.setBindings);
    const bindings = useBindingStore((state) => state.bindings);

    // Track last applied data to prevent identical updates (which cause re-renders/focus loss)
    const lastAppliedDataRef = useRef<string>("");

    const safeSetBindings = useCallback((data: any[]) => {
        // Simple but effective deep comparison for purely serializable data
        // We sort by ID to ensure order doesn't affect comparison
        const sortedData = [...data].sort((a, b) => a.id.localeCompare(b.id));
        const hash = JSON.stringify(sortedData); // Stable-ish stringify

        if (hash !== lastAppliedDataRef.current) {
            console.log(`[BindingSync] Updating bindings (changed): ${data.length} items`);
            setBindings(data);
            lastAppliedDataRef.current = hash;
            return true;
        } else {
            console.log(`[BindingSync] Skipping update (identical data)`);
            return false;
        }
    }, [setBindings]);

    // Unified sync logic
    const sync = useCallback(async (options: { skipCache?: boolean, delayServer?: boolean } = {}) => {
        if (!documentId) return;

        // 1. Cache Load (Immediate, unless skipped)
        if (!options.skipCache) {
            try {
                const cached = await bindingCache.get(documentId);
                if (cached) {
                    safeSetBindings(cached);
                    setIsLoading(false);
                }
            } catch (e) {
                console.warn("[BindingSync] Cache read error", e);
            }
        }

        // 2. Server Fetch (Delayed/Debounced check happens in useEffect)
        // We define the fetcher here but invoke it later
    }, [documentId, safeSetBindings]);

    // Manual refresh (instant server fetch)
    const refresh = useCallback(async () => {
        try {
            const result = await getDocumentBindings(documentId);
            if (result.success && result.bindings) {
                if (safeSetBindings(result.bindings)) {
                    await bindingCache.set(documentId, result.bindings);
                }
                console.log(`[BindingSync] Refreshed: ${result.bindings.length} bindings`);
            }
        } catch (e) {
            console.error("[BindingSync] Refresh error", e);
        }
    }, [documentId, safeSetBindings]);

    // Initial Load Effect with Debounce
    useEffect(() => {
        let isActive = true;
        lastAppliedDataRef.current = ""; // Reset on doc ID change

        // 1. Immediate Cache Load
        bindingCache.get(documentId).then(cached => {
            if (isActive && cached) {
                safeSetBindings(cached);
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
                    const changed = safeSetBindings(result.bindings);
                    // Always cache latest server data? Or only if changed?
                    // Better to always cache to keep it fresh
                    await bindingCache.set(documentId, result.bindings);

                    if (changed) {
                        console.log(`[BindingSync] Synced from server: ${result.bindings.length} bindings`);
                    }
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
    }, [documentId, safeSetBindings]);

    // Listen for refresh events
    useEffect(() => {
        const handleRefresh = () => refresh();
        window.addEventListener("refresh-bindings", handleRefresh);
        return () => window.removeEventListener("refresh-bindings", handleRefresh);
    }, [refresh]);

    return { isLoading, bindings };
}
