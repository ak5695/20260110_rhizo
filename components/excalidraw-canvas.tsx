"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import "@excalidraw/excalidraw/index.css";
import { useTheme } from "next-themes";
import { Maximize, Minimize, AlertCircle, Loader2, PlusCircle } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { DRAG_MIME_TYPE } from "@/lib/canvas/drag-drop-types";
import { dragDropBridge } from "@/lib/canvas/drag-drop-bridge";
import { v4 as uuidv4 } from "uuid";
import debounce from "lodash.debounce";
import { getOrCreateCanvas, saveCanvasElements, updateCanvasViewport } from "@/actions/canvas";
import { createCanvasBinding, getCanvasBindings } from "@/actions/canvas-bindings";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigationStore, useElementTarget } from "@/store/use-navigation-store";

const Excalidraw = dynamic(
    () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
    {
        ssr: false,
        loading: () => (
            <div className="h-full w-full flex items-center justify-center bg-gray-50 dark:bg-[#121212]">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
                    <div className="text-sm text-gray-500 font-medium">Initializing Workspace...</div>
                </div>
            </div>
        )
    }
);

interface ExcalidrawCanvasProps {
    documentId: string;
    className?: string;
    onChange?: (elements: readonly any[], appState: any) => void;
    isFullscreen?: boolean;
    onToggleFullscreen?: () => void;
}

const ToolbarPortal = ({ isFullscreen, onToggle }: { isFullscreen?: boolean; onToggle?: () => void }) => {
    if (!onToggle) return null;

    return (
        <button
            className="flex items-center justify-center rounded-lg transition-all transform hover:scale-105 pointer-events-auto bg-white dark:bg-[#232329] text-gray-900 dark:text-[#ced4da] shadow-lg border border-gray-200 dark:border-white/10 hover:border-rose-500/50"
            style={{
                position: "absolute",
                top: "5rem",
                left: "1rem",
                width: "2.5rem",
                height: "2.5rem",
                zIndex: 50,
            }}
            onClick={onToggle}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
            {isFullscreen ? (
                <Minimize className="h-5 w-5" />
            ) : (
                <Maximize className="h-5 w-5" />
            )}
        </button>
    );
};

export const ExcalidrawCanvas = ({ documentId, className, onChange, isFullscreen, onToggleFullscreen }: ExcalidrawCanvasProps) => {
    const { resolvedTheme } = useTheme();
    const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [canvasId, setCanvasId] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [initialElements, setInitialElements] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [bindings, setBindings] = useState<any[]>([]);

    // Track state versions to avoid redundant saves
    const lastElementsRef = useRef<string>("");
    const lastViewportRef = useRef<string>("");
    const lastSelectedIdRef = useRef<string | null>(null);
    // Removed viewport state to optimize performance as we no longer use HTML overlay

    // 1. Initial Loading
    useEffect(() => {
        const loadCanvas = async () => {
            if (!documentId) return;

            setIsLoading(true);
            try {
                const result = await getOrCreateCanvas(documentId);
                if (result.success && result.canvas) {
                    setCanvasId(result.canvas.id);
                    setInitialElements(result.elements || []);

                    // Store initial signature
                    lastElementsRef.current = JSON.stringify(result.elements || []);

                    // We'll set the viewport once API is ready
                    if (excalidrawAPI && result.canvas) {
                        excalidrawAPI.updateScene({
                            appState: {
                                scrollX: result.canvas.viewportX || 0,
                                scrollY: result.canvas.viewportY || 0,
                                zoom: { value: result.canvas.zoom || 1 }
                            }
                        });
                    }
                } else {
                    toast.error(result.error || "Failed to load workspace");
                }
            } catch (err) {
                console.error("[Canvas] Loading error:", err);
                toast.error("Network error while loading canvas");
            } finally {
                setIsLoading(false);
                setIsLoaded(true);
            }
        };

        loadCanvas();
    }, [documentId, excalidrawAPI]);

    // 1.5 Load Bindings
    useEffect(() => {
        const loadBindings = async () => {
            if (canvasId) {
                const result = await getCanvasBindings(canvasId);
                if (result.success) {
                    setBindings(result.bindings || []);
                }
            }
        };
        loadBindings();
    }, [canvasId]);

    // Use Zustand navigation store for cross-component navigation
    const elementTarget = useElementTarget();
    const { clearElementTarget, jumpToBlock } = useNavigationStore();

    // 1.8 Handle Jump-to-Element from Document (via Zustand store)
    useEffect(() => {
        if (!elementTarget || !excalidrawAPI) return;

        const elements = excalidrawAPI.getSceneElements();
        const element = elements.find((el: any) => el.id === elementTarget.id);

        if (element) {
            // Focus and zoom to element
            excalidrawAPI.scrollToContent(element, { fitToViewport: true, padding: 100 });
            excalidrawAPI.updateScene({
                appState: {
                    ...excalidrawAPI.getAppState(),
                    selectedElementIds: { [elementTarget.id]: true }
                }
            });
        }

        // Clear the target after navigation
        clearElementTarget();
    }, [elementTarget, excalidrawAPI, clearElementTarget]);

    // 2. Debounced Persistence
    const debouncedSave = useCallback(
        debounce(async (cid: string, elements: readonly any[]) => {
            const elementsToSave = elements.filter(el => !el.isDeleted);
            const currentSig = JSON.stringify(elementsToSave);

            if (currentSig === lastElementsRef.current) return;

            lastElementsRef.current = currentSig;
            try {
                const res = await saveCanvasElements(cid, [...elements]);
                if (!res.success) {
                    console.error("[Canvas] Failed to save elements:", res.error);
                    toast.error("Failed to auto-save canvas");
                }
            } catch (err) {
                console.error("[Canvas] Failed to save elements - exception:", err);
                toast.error("Failed to auto-save canvas");
            }
        }, 1500),
        []
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

    // Excalidraw onChange fires on EVERY event
    const handleCanvasChange = (elements: readonly any[], appState: any) => {
        if (!isLoaded || !canvasId) return;

        // Propagate to parent if needed
        if (onChange) {
            onChange([...elements], appState);
        }

        // Viewport tracking removed for performance (native Excalidraw links used instead)

        // Handle Bi-directional selection sync
        const selectedIds = Object.keys(appState.selectedElementIds || {});
        if (selectedIds.length === 1 && selectedIds[0] !== lastSelectedIdRef.current) {
            const selectedId = selectedIds[0];
            lastSelectedIdRef.current = selectedId;

            // Check if this ID has a binding
            const binding = bindings.find(b => b.elementId === selectedId);
            if (binding && binding.blockId) {
                // Get element label/text for better UI feedback
                const element = elements.find(el => el.id === selectedId);
                const label = element?.text || binding.anchorText || "Linked Block";

                // Use Zustand store to navigate to block
                jumpToBlock(binding.blockId, label.substring(0, 20) + (label.length > 20 ? "..." : ""));
                console.log("[Canvas] Jumping to block:", binding.blockId);
            }
        } else if (selectedIds.length === 0) {
            lastSelectedIdRef.current = null;
        }

        // ============================================================================
        // IMPORTANT: DO NOT modify elements in onChange callback!
        // ============================================================================
        // Modifying elements (e.g., adding links) during onChange can cause:
        // 1. State inconsistencies between Excalidraw's internal state and our state
        // 2. Fractional index invariant violations
        // 3. Infinite re-render loops
        //
        // Link hydration should be done:
        // - At initial load time (in getOrCreateCanvas)
        // - Via updateScene API (not in onChange)
        // ============================================================================

        // Save the ORIGINAL elements as-is, preserving Excalidraw's ordering
        debouncedSave(canvasId, [...elements]);

        // Save viewport
        debouncedViewportSave(canvasId, {
            x: appState.scrollX,
            y: appState.scrollY,
            zoom: appState.zoom.value
        });
    };

    // --- Cognitive Visibility: Native Links (No Overlay) ---
    // We rely on Excalidraw's native link rendering for maximum performance.
    // The link 'jotion://block/...' serves as the indicator.

    // Handle drag events

    // Handle drag events
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes(DRAG_MIME_TYPE)) {
            e.dataTransfer.dropEffect = "copy";
            setIsDragOver(true);
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        if (!excalidrawAPI) {
            console.warn("[ExcalidrawCanvas] API not ready");
            return;
        }

        // Get drag payload
        const payloadStr = e.dataTransfer.getData(DRAG_MIME_TYPE);
        if (!payloadStr) {
            console.warn("[ExcalidrawCanvas] No drag payload");
            return;
        }

        const payload = dragDropBridge.deserializeDragPayload(payloadStr);
        if (!payload) {
            console.warn("[ExcalidrawCanvas] Failed to parse payload");
            return;
        }

        // Get drop position relative to canvas
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const appState = excalidrawAPI.getAppState();
        const zoom = appState.zoom?.value || 1;
        const scrollX = appState.scrollX || 0;
        const scrollY = appState.scrollY || 0;

        // Convert screen coordinates to canvas coordinates
        const canvasX = (e.clientX - rect.left) / zoom - scrollX;
        const canvasY = (e.clientY - rect.top) / zoom - scrollY;

        // Create hand-drawn style rectangle with text
        const text = payload.text;

        // Constants for coordinate calculation
        const charsPerLine = 25;
        const fontSize = 16;
        const lineHeight = 1.5;
        const padding = 20;

        // Calculate width and height based on text length
        const lines = text.split("\n").length;
        const textWidth = Math.min(text.length, charsPerLine) * (fontSize * 0.6);
        const textHeight = lines * fontSize * lineHeight;

        const width = Math.max(180, textWidth + padding * 2);
        const height = Math.max(60, textHeight + padding * 2);

        const rectId = uuidv4();
        const textId = uuidv4();

        // Rectangle container
        const rectangle: any = {
            id: rectId,
            type: "rectangle",
            x: canvasX,
            y: canvasY,
            width,
            height,
            angle: 0,
            strokeColor: "#1e1e1e",
            backgroundColor: "#fef9c3", // Light yellow
            fillStyle: "hachure", // Hand-drawn hachure fill
            strokeWidth: 2,
            strokeStyle: "solid",
            roughness: 1, // Hand-drawn roughness
            opacity: 100,
            groupIds: [],
            frameId: null,
            roundness: { type: 3 },
            seed: Math.floor(Math.random() * 100000),
            version: 1,
            versionNonce: Math.floor(Math.random() * 100000),
            isDeleted: false,
            boundElements: [{ type: "text", id: textId }],
            updated: Date.now(),
            link: payload.blockId ? `jotion://block/${payload.blockId}` : null, // Native visibility
            locked: false,
        };

        const wrappedText = text;

        // Text element inside rectangle
        const textElement: any = {
            id: textId,
            type: "text",
            x: canvasX + padding,
            y: canvasY + padding,
            width: width - padding * 2,
            height: height - padding * 2,
            angle: 0,
            strokeColor: "#1e1e1e",
            backgroundColor: "transparent",
            fillStyle: "solid",
            strokeWidth: 1,
            strokeStyle: "solid",
            roughness: 0,
            opacity: 100,
            groupIds: [],
            frameId: null,
            roundness: null,
            seed: Math.floor(Math.random() * 100000),
            version: 2,
            versionNonce: Math.floor(Math.random() * 100000),
            isDeleted: false,
            boundElements: null,
            updated: Date.now(),

            locked: false,
            text: wrappedText,
            fontSize,
            fontFamily: 1,
            textAlign: "center",
            verticalAlign: "middle",
            containerId: rectId,
            originalText: wrappedText,
            lineHeight: lineHeight,
            link: payload.blockId ? `jotion://block/${payload.blockId}` : null, // Native visibility
        };

        // Add elements to Excalidraw
        // Note: For newer Excalidraw, it's safer to let it handle indexing.
        // We ensure rectangle comes before text in the array.
        const currentElements = excalidrawAPI.getSceneElements();
        excalidrawAPI.updateScene({
            elements: [...currentElements, rectangle, textElement],
            appState: {
                ...excalidrawAPI.getAppState(),
                selectedElementIds: {
                    [rectId]: true,
                }
            }
        });

        // 3. Create Binding in database
        if (canvasId && payload.blockId) {
            createCanvasBinding({
                canvasId,
                documentId,
                elementId: rectId,
                blockId: payload.blockId,
                bindingType: "direct",
                sourceType: payload.sourceType,
                anchorText: payload.text,
                metadata: payload.metadata
            }).then(result => {
                if (result.success && result.binding) {
                    setBindings(prev => [...prev, result.binding]);
                    window.dispatchEvent(new CustomEvent("refresh-bindings"));
                    toast.success("Linked to document");
                }
            });
        }

        console.log("[ExcalidrawCanvas] Created elements from drop:", { text: text.substring(0, 50) });
    }, [excalidrawAPI]);

    if (isLoading && !excalidrawAPI) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-gray-50 dark:bg-[#121212]">
                <div className="flex flex-col items-center gap-3 animate-pulse">
                    <Loader2 className="h-10 w-10 text-rose-500 animate-spin" />
                    <span className="text-sm font-medium text-gray-400">Loading Canvas State...</span>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative h-full w-full overflow-hidden transition-all duration-300",
                isDragOver && "ring-4 ring-rose-500/30 ring-inset bg-rose-50/5",
                className
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Visual indication for drag and drop */}
            {isDragOver && (
                <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center bg-rose-500/5 backdrop-blur-[2px]">
                    <div className="bg-white dark:bg-gray-800 px-6 py-4 rounded-2xl shadow-2xl border-2 border-dashed border-rose-500 flex flex-col items-center gap-2 transform scale-110 transition-transform">
                        <div className="w-12 h-12 bg-rose-500 rounded-full flex items-center justify-center text-white animation-bounce">
                            <PlusCircle className="h-6 w-6" />
                        </div>
                        <p className="text-lg font-bold text-rose-600 dark:text-rose-400">Release to add to Canvas</p>
                    </div>
                </div>
            )}

            <Excalidraw
                excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
                theme={resolvedTheme === "dark" ? "dark" : "light"}
                initialData={{
                    elements: initialElements,
                    appState: {
                        viewBackgroundColor: resolvedTheme === "dark" ? "#121212" : "#ffffff",
                        currentItemStrokeColor: resolvedTheme === "dark" ? "#ffffff" : "#000000",
                    }
                }}
                onChange={handleCanvasChange}
                onLinkOpen={(element, event) => {
                    if (element.link && element.link.startsWith("jotion://block/")) {
                        event.preventDefault();
                        const blockId = element.link.replace("jotion://block/", "");

                        // Use Zustand store to navigate to block
                        jumpToBlock(blockId, 'text' in element ? (element as any).text : "Linked Block");
                        console.log("[Canvas] Intercepted link click, jumping to block:", blockId);
                    }
                }}
            />

            {onToggleFullscreen && (
                <ToolbarPortal isFullscreen={isFullscreen} onToggle={onToggleFullscreen} />
            )}
        </div>
    );
};

export default ExcalidrawCanvas;

/**
 * Helper to wrap text (kept as fallback)
 */
function wrapText(text: string, maxCharsPerLine: number): string {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
        if (currentLine.length + word.length + 1 <= maxCharsPerLine) {
            currentLine += (currentLine ? " " : "") + word;
        } else {
            if (currentLine) {
                lines.push(currentLine);
            }
            if (word.length > maxCharsPerLine) {
                let remaining = word;
                while (remaining.length > maxCharsPerLine) {
                    lines.push(remaining.slice(0, maxCharsPerLine));
                    remaining = remaining.slice(maxCharsPerLine);
                }
                currentLine = remaining;
            } else {
                currentLine = word;
            }
        }
    }

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines.join("\n");
}
