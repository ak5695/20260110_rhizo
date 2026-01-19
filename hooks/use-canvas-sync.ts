"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import debounce from "lodash.debounce";
import { toast } from "sonner";
import { getOrCreateCanvas, saveCanvasElements, updateCanvasViewport } from "@/actions/canvas";
import { canvasCache } from "@/lib/cache/canvas-cache";

export const useCanvasSync = (
    documentId: string,
    excalidrawAPI: any,
    isReadOnly: boolean = false
) => {
    const [canvasId, setCanvasId] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [initialElements, setInitialElements] = useState<any[]>([]);
    const [initialFiles, setInitialFiles] = useState<any>({});
    const [isLoading, setIsLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<"idle" | "pending" | "saving">("idle");

    // Track state versions to avoid redundant saves
    const lastElementsRef = useRef<string>("");
    const lastViewportRef = useRef<string>("");

    // Track if initial load is complete
    const initialLoadCompleteRef = useRef(false);
    const localVersionRef = useRef(0);

    // Track excalidrawAPI with ref to access inside async closures
    const excalidrawRef = useRef(excalidrawAPI);
    useEffect(() => {
        excalidrawRef.current = excalidrawAPI;
    }, [excalidrawAPI]);

    // 1. Initial Loading - Cache-First & Optimistic Strategy
    useEffect(() => {
        if (!documentId) return;

        // Cancellation flag to ignore stale results
        let isActive = true;
        let syncTimer: NodeJS.Timeout;

        // Reset to loading state when document changes (even if optimistic unblock happens later)
        if (!initialLoadCompleteRef.current) {
            setIsLoading(true);
        }

        const loadCanvas = async () => {
            console.log('[Canvas] Starting initial load for:', documentId);

            let cacheLoaded = false;
            try {
                const cached = await canvasCache.get(documentId);
                // If component unmounted or doc changed, abort
                if (!isActive) return;

                if (cached) {
                    console.log('[Canvas] Instant load from cache:', cached.elements.length, 'elements, version:', cached.version);
                    setCanvasId(cached.canvasId);
                    setInitialElements(cached.elements);
                    lastElementsRef.current = JSON.stringify(cached.elements);
                    localVersionRef.current = cached.version || Date.now();
                    cacheLoaded = true;
                }
            } catch (err) {
                console.warn('[Canvas] Cache read failed:', err);
            }

            // OPTIMISTIC UNBLOCK: Allow UI to render immediately
            if (isActive) {
                setIsLoading(false);
                setIsLoaded(true);
            }

            // DEBOUNCED SERVER FETCH (500ms)
            // If user switches away within 500ms, this request is never sent.
            syncTimer = setTimeout(async () => {
                if (!isActive) return;

                try {
                    // Background Server Fetch
                    const result = await getOrCreateCanvas(documentId);

                    if (!isActive) {
                        console.log('[Canvas] Request cancelled/stale for:', documentId);
                        return;
                    }

                    if (result.success && result.canvas) {
                        const serverElements = result.elements || [];
                        const serverFiles = result.files || {};
                        const serverVersion = result.canvas.version || 0;

                        if (cacheLoaded && localVersionRef.current > serverVersion) {
                            console.log('[Canvas] Local cache is newer, skipping server data');
                            setCanvasId(result.canvas.id);
                        } else {
                            console.log('[Canvas] Using server data:', serverElements.length, 'elements');
                            setCanvasId(result.canvas.id);

                            if (!cacheLoaded) {
                                setInitialElements(serverElements);
                                setInitialFiles(serverFiles);
                                lastElementsRef.current = JSON.stringify(serverElements);

                                // LATE HYDRATION: Detect if we loaded empty but now have data
                                if (serverElements.length > 0 && excalidrawRef.current) {
                                    const currentElements = excalidrawRef.current.getSceneElements();
                                    if (currentElements.length === 0) {
                                        excalidrawRef.current.updateScene({ elements: serverElements });
                                        if (serverFiles && Object.keys(serverFiles).length > 0) {
                                            excalidrawRef.current.addFiles(Object.values(serverFiles));
                                        }
                                        if (result.canvas.zoom) {
                                            excalidrawRef.current.updateScene({
                                                appState: {
                                                    ...excalidrawRef.current.getAppState(),
                                                    scrollX: result.canvas.viewportX || 0,
                                                    scrollY: result.canvas.viewportY || 0,
                                                    zoom: { value: result.canvas.zoom }
                                                }
                                            });
                                        }
                                        toast.success("Workspace loaded from server");
                                    }
                                }
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
                    }
                } catch (err) {
                    if (isActive) {
                        console.error("[Canvas] Server sync error:", err);
                    }
                } finally {
                    if (isActive) {
                        initialLoadCompleteRef.current = true;
                    }
                }
            }, 500);
        };

        loadCanvas();

        return () => {
            isActive = false;
            clearTimeout(syncTimer);
            initialLoadCompleteRef.current = false;
        };
    }, [documentId]);

    // 2. Debounced Persistence
    const debouncedSave = useCallback(
        debounce(async (cid: string, elements: readonly any[]) => {
            if (isReadOnly) return;
            setSaveStatus("saving");
            const elementsToSave = elements.filter(el => !el.isDeleted);
            const currentSig = JSON.stringify(elementsToSave);

            if (currentSig === lastElementsRef.current) {
                setSaveStatus("idle");
                return;
            }

            lastElementsRef.current = currentSig;

            try {
                const res = await saveCanvasElements(cid, [...elements]);

                if (!res.success) {
                    console.error("[Canvas] Failed to save elements:", res.error);
                    toast.error("Failed to auto-save canvas");
                    return;
                }

                if (typeof res.version === 'number') {
                    // Update local version to match server's authoritative version
                    const newVersion = res.version;
                    localVersionRef.current = newVersion;

                    // Update cache with new version
                    if (documentId && cid) {
                        const appState = excalidrawAPI?.getAppState();
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
                } else {
                    // Fallback if server doesn't return version (shouldn't happen with new action)
                    console.warn('[Canvas] Server save didn\'t return version, sync might vary');
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
            if (isReadOnly) return;
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
        initialFiles,
        saveStatus,
        setSaveStatus,
        syncElements: debouncedSave,
        syncViewport: debouncedViewportSave
    };
};
