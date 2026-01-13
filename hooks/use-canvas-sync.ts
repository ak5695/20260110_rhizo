"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import debounce from "lodash.debounce";
import { toast } from "sonner";
import { getOrCreateCanvas, saveCanvasElements, updateCanvasViewport } from "@/actions/canvas";
import { canvasCache } from "@/lib/cache/canvas-cache";

export const useCanvasSync = (
    documentId: string,
    excalidrawAPI: any
) => {
    const [canvasId, setCanvasId] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [initialElements, setInitialElements] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<"idle" | "pending" | "saving">("idle");

    // Track state versions to avoid redundant saves
    const lastElementsRef = useRef<string>("");
    const lastViewportRef = useRef<string>("");

    // Track if initial load is complete
    const initialLoadCompleteRef = useRef(false);
    const localVersionRef = useRef(0);

    // 1. Initial Loading - Cache-First Strategy
    useEffect(() => {
        if (!documentId) return;
        if (initialLoadCompleteRef.current) return;

        const loadCanvas = async () => {
            console.log('[Canvas] Starting initial load for:', documentId);

            let cacheLoaded = false;
            try {
                const cached = await canvasCache.get(documentId);
                if (cached) {
                    console.log('[Canvas] Instant load from cache:', cached.elements.length, 'elements, version:', cached.version);
                    setCanvasId(cached.canvasId);
                    setInitialElements(cached.elements);
                    lastElementsRef.current = JSON.stringify(cached.elements);
                    localVersionRef.current = cached.version || Date.now();

                    setIsLoading(false);
                    setIsLoaded(true);
                    cacheLoaded = true;
                }
            } catch (err) {
                console.warn('[Canvas] Cache read failed:', err);
            }

            try {
                const result = await getOrCreateCanvas(documentId);
                if (result.success && result.canvas) {
                    const serverElements = result.elements || [];
                    const serverVersion = result.canvas.version || 0;

                    if (cacheLoaded && localVersionRef.current > serverVersion) {
                        console.log('[Canvas] Local cache is newer, skipping server data');
                        setCanvasId(result.canvas.id);
                    } else {
                        console.log('[Canvas] Using server data:', serverElements.length, 'elements');
                        setCanvasId(result.canvas.id);

                        if (!cacheLoaded) {
                            setInitialElements(serverElements);
                            lastElementsRef.current = JSON.stringify(serverElements);
                        }

                        // Update cache
                        canvasCache.set(documentId, {
                            canvasId: result.canvas.id,
                            elements: serverElements,
                            viewport: {
                                x: result.canvas.viewportX || 0,
                                y: result.canvas.viewportY || 0,
                                zoom: result.canvas.zoom || 1
                            },
                            version: serverVersion
                        });
                        localVersionRef.current = serverVersion;
                    }
                } else if (!cacheLoaded) {
                    toast.error(result.error || "Failed to load workspace");
                }
            } catch (err) {
                console.error("[Canvas] Server sync error:", err);
                if (!cacheLoaded) {
                    toast.error("Network error - showing cached data");
                }
            } finally {
                setIsLoading(false);
                setIsLoaded(true);
                initialLoadCompleteRef.current = true;
            }
        };

        loadCanvas();
    }, [documentId]);

    // 2. Debounced Persistence
    const debouncedSave = useCallback(
        debounce(async (cid: string, elements: readonly any[]) => {
            setSaveStatus("saving");
            const elementsToSave = elements.filter(el => !el.isDeleted);
            const currentSig = JSON.stringify(elementsToSave);

            if (currentSig === lastElementsRef.current) {
                setSaveStatus("idle");
                return;
            }

            lastElementsRef.current = currentSig;

            // Update local cache first
            if (documentId && cid) {
                const appState = excalidrawAPI?.getAppState();
                const newVersion = Date.now();
                localVersionRef.current = newVersion;

                canvasCache.set(documentId, {
                    canvasId: cid,
                    elements: [...elements],
                    viewport: {
                        x: appState?.scrollX || 0,
                        y: appState?.scrollY || 0,
                        zoom: appState?.zoom?.value || 1
                    },
                    version: newVersion
                }).catch(err => console.warn('[Canvas] Cache update failed:', err));
            }

            try {
                const res = await saveCanvasElements(cid, [...elements]);
                if (!res.success) {
                    console.error("[Canvas] Failed to save elements:", res.error);
                    toast.error("Failed to auto-save canvas");
                }
            } catch (err) {
                console.error("[Canvas] Failed to save elements - exception:", err);
                toast.error("Failed to auto-save canvas");
            } finally {
                setSaveStatus("idle");
            }
        }, 800, { maxWait: 4000 }),
        [documentId, excalidrawAPI]
    );

    const debouncedViewportSave = useCallback(
        debounce(async (cid: string, viewport: any) => {
            const currentSig = JSON.stringify(viewport);
            if (currentSig === lastViewportRef.current) return;

            lastViewportRef.current = currentSig;
            await updateCanvasViewport(cid, viewport);
        }, 3000),
        []
    );

    // Cleanup
    useEffect(() => {
        return () => {
            debouncedSave.flush();
            debouncedViewportSave.flush();
        };
    }, [debouncedSave, debouncedViewportSave]);

    return {
        canvasId,
        isLoaded,
        isLoading,
        initialElements,
        saveStatus,
        setSaveStatus,
        syncElements: debouncedSave,
        syncViewport: debouncedViewportSave
    };
};
