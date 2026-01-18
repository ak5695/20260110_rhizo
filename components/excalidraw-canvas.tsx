"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
// import "@excalidraw/excalidraw/index.css"; // Moved to layout.tsx
import { useTheme } from "next-themes";
import { Maximize, Minimize, Loader2 } from "lucide-react";
import { useEffect, useState, useRef, useCallback, useMemo, memo } from "react";
import { DRAG_MIME_TYPE } from "@/lib/canvas/drag-drop-types";
import { dragDropBridge } from "@/lib/canvas/drag-drop-bridge";
import { v4 as uuidv4 } from "uuid";
import { createCanvasBinding, getCanvasBindings } from "@/actions/canvas-bindings";
import { toast } from "sonner";
import { useNavigationStore, useElementTarget } from "@/store/use-navigation-store";
import { useBindingStore } from "@/store/use-binding-store";
import { ConnectionPointsOverlay } from "@/components/canvas/connection-points-overlay";
import { useCanvasSync } from "@/hooks/use-canvas-sync";
import { CanvasStatusIndicator } from "@/components/canvas/canvas-status-indicator";

const DEFAULT_EXCALIDRAW_OPTIONS = {
    currentItemFontFamily: 1, // 1: Klee (Hand-drawn), 2: Normal, 3: Code
    currentItemFontSize: 20,
    currentItemTextAlign: "left",
    currentItemStrokeSharpness: "round",
    currentItemRoundness: "lg",
    currentItemOpacity: 100,
    currentItemStrokeWidth: 2, // Slightly bolder for better visibility
    currentItemRoughness: 1, // 0: Clean, 1: Sketchy, 2: Messy
    currentItemStrokeStyle: "solid",
    currentItemStartArrowhead: null,
    currentItemEndArrowhead: null,
    currentItemFillStyle: "hachure",
};

const Excalidraw = dynamic(
    async () => {
        const { Excalidraw, MainMenu, WelcomeScreen } = await import("@excalidraw/excalidraw");

        const ExcalidrawWrapper = (props: any) => {
            return (
                <Excalidraw {...props}>
                    <MainMenu>
                        <MainMenu.DefaultItems.LoadScene />
                        <MainMenu.DefaultItems.SaveToActiveFile />
                        <MainMenu.DefaultItems.Export />
                        <MainMenu.DefaultItems.SaveAsImage />
                        <MainMenu.DefaultItems.Help />
                        <MainMenu.DefaultItems.ClearCanvas />
                        <MainMenu.Separator />
                        <MainMenu.DefaultItems.ToggleTheme />
                        <MainMenu.DefaultItems.ChangeCanvasBackground />
                    </MainMenu>
                </Excalidraw>
            );
        };
        return ExcalidrawWrapper;
    },
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
    viewModeEnabled?: boolean;
}



interface Binding {
    id: string;
    elementId: string;
    blockId: string;
    // ... other fields
}

// Note: CanvasBindingLayer removed - Excalidraw has native link indicators

const ExcalidrawCanvasComponent = ({ documentId, className, onChange, viewModeEnabled = false }: ExcalidrawCanvasProps) => {
    const { resolvedTheme } = useTheme();
    const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

    // Memoize API setter to prevent unnecessary re-renders of Excalidraw
    const handleSetExcalidrawAPI = useCallback((api: any) => {
        setExcalidrawAPI(api);
    }, []);

    const containerRef = useRef<HTMLDivElement>(null);

    // Responsive: Monitor container width to toggle compact mode
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const width = entry.contentRect.width;
                // If width < 860px, add compact class for layout adjustments
                if (width < 860) {
                    container.classList.add("excalidraw-compact");
                } else {
                    container.classList.remove("excalidraw-compact");
                }

                // Dynamic Scale: Proportionally shrink the UI based on container width
                // Base threshold 860px. If width is 430px, scale is 0.5.
                // Clamp between 0.6 and 1.0 to maintain usability.
                const scale = Math.min(1, Math.max(0.6, width / 860));
                container.style.setProperty("--canvas-toolbar-scale", scale.toString());
            }
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    // Use custom hook for canvas sync
    const {
        canvasId,
        isLoaded,
        isLoading,
        initialElements,
        saveStatus,
        syncElements,
        syncViewport
    } = useCanvasSync(documentId, excalidrawAPI, viewModeEnabled);

    // 1.25 Stabilize initialData to prevent "controlled to uncontrolled" errors
    // Identity stability of initialData is critical for Excalidraw's internal state management.
    // We use a ref to ensure that once the initial state is captured, it NEVER changes identity.
    const initialDataRef = useRef<any>(null);
    const initialData = useMemo(() => {
        // Wait until loaded (optimistic)
        if (!isLoaded) return null;

        // If we already captured the initial data for this mount session, return it
        if (initialDataRef.current) return initialDataRef.current;

        // Capture initial state - let Excalidraw handle ALL colors via theme prop
        const data = {
            elements: initialElements || [],
            appState: {
                // Let Excalidraw's theme handle ALL colors (background, stroke, etc.)
                name: "Rhizo Workspace",
                collaborators: new Map(),
                isLoading: false,
                user: { name: "Collaborator", id: "user-1" },
                // Explicitly define controlled properties to avoid "controlled to uncontrolled" error
                zoom: { value: 1 },
                scrollX: 0,
                scrollY: 0,
                ...DEFAULT_EXCALIDRAW_OPTIONS,
            },
            scrollToContent: true,
        };

        initialDataRef.current = data;
        console.log("[Canvas] initialData stabilized for documentId:", documentId);
        return data;
    }, [isLoaded, canvasId, initialElements, resolvedTheme, documentId]);

    // Sync theme changes - only update theme, let Excalidraw handle background colors
    useEffect(() => {
        if (!excalidrawAPI || !resolvedTheme) return;

        const currentTheme = excalidrawAPI.getAppState().theme;
        const newTheme = resolvedTheme === "dark" ? "dark" : "light";

        // Only update if theme is different
        if (currentTheme !== newTheme) {
            excalidrawAPI.updateScene({
                appState: {
                    ...excalidrawAPI.getAppState(),
                    theme: newTheme,
                }
            });
            console.log("[Canvas] Theme synced to:", newTheme);
        }
    }, [resolvedTheme, excalidrawAPI]);

    const [isDragOver, setIsDragOver] = useState(false);
    const [bindings, setBindings] = useState<any[]>([]);

    // Selection tracking for bi-directional link navigation
    const lastSelectedIdRef = useRef<string | null>(null);

    // 1.5 Load Bindings + Initialize Client-side BindingStore (Optimistic UI)
    const initializeBindingStore = useBindingStore(state => state.initialize);
    const bindingStoreInitialized = useBindingStore(state => state.initialized);

    useEffect(() => {
        const loadBindings = async () => {
            if (canvasId) {
                // Load bindings from server and initialize client-side store
                const result = await getCanvasBindings(canvasId);
                if (result.success) {
                    // Filter out deleted element bindings
                    const activeBindings = (result.bindings || []).filter(b => !b.isElementDeleted);

                    // Initialize client-side binding store for instant sync
                    initializeBindingStore(canvasId, activeBindings);

                    // Also update local state for overlay rendering
                    setBindings(activeBindings);

                    console.log('[Canvas] Loaded', activeBindings.length, 'bindings into client store');
                }
            }
        };
        loadBindings();
    }, [canvasId, initializeBindingStore]);

    // Use Zustand navigation store for cross-component navigation
    const elementTarget = useElementTarget();

    // 1. Navigation Helper (Jump to Block)
    const { jumpToElement } = useNavigationStore();
    const jumpToBlock = useCallback((blockId: string, text: string, focusElementId?: string) => {
        // ... (existing)
        const element = document.querySelector(`[data-id="${blockId}"]`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Flash effect
            element.classList.add('bg-orange-100');
            setTimeout(() => element.classList.remove('bg-orange-100'), 2000);

            // Set element target for Highlight
            useNavigationStore.getState().jumpToBlock(blockId, text, focusElementId);
        } else {
            console.warn("[Canvas] Block not found in DOM:", blockId);
            toast.error("Block not found in current view");
        }
    }, [documentId]);

    const clearElementTarget = useCallback(() => {
        const { elementTarget } = useNavigationStore.getState();
        if (elementTarget) {
            useNavigationStore.getState().clearElementTarget();

            // Also update excalidraw selection if needed
            if (excalidrawAPI) {
                // Optionally clear selection
            }
        }
    }, [excalidrawAPI]);

    // 1.8 Handle Jump-to-Element from Document (via Zustand store)
    useEffect(() => {
        if (!elementTarget || !excalidrawAPI) return;

        const elements = excalidrawAPI.getSceneElements();
        const element = elements.find((el: any) => el.id === elementTarget.id);

        if (element) {
            // 1. Set zoom first
            excalidrawAPI.updateScene({
                appState: {
                    ...excalidrawAPI.getAppState(),
                    zoom: { value: 0.6 }
                }
            });

            // 2. Scroll to content after zoom is applied (small delay to ensure state update)
            setTimeout(() => {
                excalidrawAPI.scrollToContent([element], { fitToViewport: false, animate: true });
                excalidrawAPI.updateScene({
                    appState: {
                        ...excalidrawAPI.getAppState(),
                        selectedElementIds: { [elementTarget.id]: true }
                    }
                });
            }, 100);
        }

        // Clear the target after navigation
        clearElementTarget();
    }, [elementTarget, excalidrawAPI, clearElementTarget]);

    // 1.85 Handle Link Click from Canvas (Targeted Highlight)
    const handleLinkOpen = useCallback((element: any, event: any) => {
        if (element.link && element.link.startsWith("jotion://block/")) {
            event.preventDefault();
            const blockId = element.link.replace("jotion://block/", "");

            // Use Zustand store to navigate to block
            // Pass element.id for targeted highlighting in editor
            jumpToBlock(
                blockId,
                'text' in element ? (element as any).text : "Linked Block",
                element.id
            );
            console.log("[Canvas] Intercepted link click, jumping to block:", blockId, "focus element:", element.id);
        }
    }, [jumpToBlock]);




    // 【Optimistic UI】增量删除检测 - 客户端即时更新
    const prevActiveElementsRef = useRef<Set<string>>(new Set());
    const hideByElementIds = useBindingStore(state => state.hideByElementIds);
    const showByElementIds = useBindingStore(state => state.showByElementIds);

    const detectAndCleanupDeletedBindings = useCallback(
        (currentElements: readonly any[]) => {
            const currentActiveIds = new Set(
                currentElements.filter(el => !el.isDeleted).map(el => el.id)
            );
            const prevActiveIds = prevActiveElementsRef.current;

            // 1. Detect Deleted (Present in Prev, Missing in Current)
            const newlyDeletedIds = Array.from(prevActiveIds).filter(
                id => !currentActiveIds.has(id)
            );

            // 2. Detect Restored (Missing in Prev, Present in Current) -> Undo Action
            const newlyRestoredIds = Array.from(currentActiveIds).filter(
                id => !prevActiveIds.has(id)
            );

            if (newlyDeletedIds.length > 0) {
                console.log('[Canvas] Detected deleted elements:', newlyDeletedIds);
                hideByElementIds(newlyDeletedIds);
                window.dispatchEvent(new Event('refresh-bindings'));
            }

            if (newlyRestoredIds.length > 0) {
                console.log('[Canvas] Detected restored elements:', newlyRestoredIds);
                showByElementIds(newlyRestoredIds);
                window.dispatchEvent(new Event('refresh-bindings'));
            }

            prevActiveElementsRef.current = currentActiveIds;
        },
        [hideByElementIds, showByElementIds]
    );

    // Excalidraw onChange fires on EVERY event
    const handleCanvasChange = useCallback((elements: readonly any[], appState: any) => {
        if (!isLoaded || !canvasId) return;

        // Propagate to parent if needed
        if (onChange) {
            onChange([...elements], appState);
        }

        // 【即时同步】检测删除并立即更新客户端状态
        detectAndCleanupDeletedBindings(elements);

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
                // Pass the elementId so the document can focus the specific link
                jumpToBlock(
                    binding.blockId,
                    label.substring(0, 20) + (label.length > 20 ? "..." : ""),
                    selectedId
                );
                console.log("[Canvas] Jumping to block:", binding.blockId, "focusing element:", selectedId);
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
        syncElements(canvasId, [...elements]);

        // Save viewport
        syncViewport(canvasId, {
            x: appState.scrollX,
            y: appState.scrollY,
            zoom: appState.zoom.value
        });
    }, [isLoaded, canvasId, onChange, detectAndCleanupDeletedBindings, bindings, jumpToBlock, syncElements, syncViewport]);

    // 3. Real-time Content Sync Listener (Document -> Canvas)
    useEffect(() => {
        if (!excalidrawAPI) return;

        const handleBlockChange = (e: any) => {
            const { blockId, text } = e.detail;
            if (!blockId) return;

            const link = `jotion://block/${blockId}`;
            const elements = excalidrawAPI.getSceneElements();

            // Strategy: Find TEXT elements with this link and update them
            // We assume text elements created by drag-drop have the link property.

            let needsUpdate = false;
            const updatedElements = elements.map((el: any) => {
                if (el.type === "text" && el.link === link) {
                    // Only update if text content is different
                    // Note: This simplistic update might not resize the text container ideally
                    // but Excalidraw usually handles text reflow on next render.
                    if (el.text !== text) {
                        needsUpdate = true;
                        return {
                            ...el,
                            text: text,
                            originalText: text,
                            version: el.version + 1,
                            versionNonce: Math.floor(Math.random() * 100000)
                        };
                    }
                }
                return el;
            });

            if (needsUpdate) {
                excalidrawAPI.updateScene({
                    elements: updatedElements
                });
                console.log(`[Canvas] Synced text for block ${blockId}`);
            }
        };

        window.addEventListener("document:block-change", handleBlockChange);
        return () => window.removeEventListener("document:block-change", handleBlockChange);
    }, [excalidrawAPI]);

    // 4. EAS: Listen for binding restoration (undo/restore events)
    useEffect(() => {
        if (!excalidrawAPI) return;

        const handleBindingShown = (e: any) => {
            const { bindingId, elementId } = e.detail;
            console.log('[Canvas] Binding shown (restore):', bindingId, elementId);

            // Restore Canvas element from hidden/deleted state
            const elements = excalidrawAPI.getSceneElements();
            const element = elements.find((el: any) => el.id === elementId);

            if (element && element.isDeleted) {
                excalidrawAPI.updateScene({
                    elements: elements.map((el: any) =>
                        el.id === elementId ? { ...el, isDeleted: false } : el
                    )
                });
                console.log('[Canvas] Restored element:', elementId);
            }
        };

        window.addEventListener('binding:shown', handleBindingShown);
        return () => window.removeEventListener('binding:shown', handleBindingShown);
    }, [excalidrawAPI]);

    // 5. Handle AI Chart Insertion
    useEffect(() => {
        if (!excalidrawAPI) return;

        const handleInsertAiChart = (e: CustomEvent) => {
            const { chart } = e.detail;
            if (!chart || !chart.elements) return;

            console.log("[Canvas] Inserting AI Chart:", chart);

            const currentElements = excalidrawAPI.getSceneElements();
            const appState = excalidrawAPI.getAppState();

            // Simple placement strategy: Place to the right of existing content plus padding
            let maxX = -Infinity;
            let minY = Infinity;

            if (currentElements.length > 0) {
                currentElements.forEach((el: any) => {
                    if (el.x + el.width > maxX) maxX = el.x + el.width;
                    if (el.y < minY) minY = el.y;
                });
            } else {
                maxX = 0;
                minY = 0;
            }

            const startX = maxX + 100; // 100px padding
            const startY = minY !== Infinity ? minY : 0;

            // Normalize chart elements to start at (0,0) then translate to (startX, startY)
            // Calculate chart bounds
            let chartMinX = Infinity;
            let chartMinY = Infinity;
            chart.elements.forEach((el: any) => {
                if (el.x < chartMinX) chartMinX = el.x;
                if (el.y < chartMinY) chartMinY = el.y;
            });

            // Translate
            const newElements = chart.elements.map((el: any) => ({
                ...el,
                id: el.id || crypto.randomUUID(), // Ensure IDs
                x: (el.x - chartMinX) + startX,
                y: (el.y - chartMinY) + startY,
                version: 1,
                versionNonce: Math.floor(Math.random() * 1000000),
            }));

            // Update scene
            excalidrawAPI.updateScene({
                elements: [...currentElements, ...newElements],
                appState: {
                    ...appState,
                    // Select the new elements
                    selectedElementIds: newElements.reduce((acc: any, el: any) => {
                        acc[el.id] = true;
                        return acc;
                    }, {})
                }
            });

            // Zoom to fit
            excalidrawAPI.scrollToContent(newElements, { fitToViewport: true, animate: true });
            toast.success("AI Generated Chart Inserted");
        };

        window.addEventListener("insert-ai-chart", handleInsertAiChart as EventListener);
        return () => window.removeEventListener("insert-ai-chart", handleInsertAiChart as EventListener);
    }, [excalidrawAPI]);

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
        // 【即时标记】立即通知 Editor 应用文本样式（不等待服务器）
        // 移至 updateScene 之前以消除渲染延迟
        if (payload.blockId) {
            window.dispatchEvent(new CustomEvent("document:canvas-binding-success", {
                detail: {
                    elementId: rectId,
                    blockId: payload.blockId,
                    metadata: payload.metadata,
                    optimistic: true // 标记为乐观更新
                }
            }));
            console.log("[Canvas] Optimistic mark applied for block:", payload.blockId);
        }

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



        // 3. 后台异步持久化绑定（不阻塞UI）
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
                    // Register with client-side BindingStore for instant tracking
                    useBindingStore.getState().registerBinding(result.binding);

                    setBindings(prev => [...prev, result.binding]);
                    window.dispatchEvent(new CustomEvent("refresh-bindings"));

                    // 服务器确认成功
                    console.log("[Canvas] Binding persisted to server:", result.binding.id);
                } else {
                    // 服务器失败 - 可选：回滚标记
                    console.error("[Canvas] Failed to persist binding:", result.error);
                    toast.error("Failed to save link, but mark is applied locally");
                }
            }).catch(err => {
                console.error("[Canvas] Binding creation error:", err);
            });
        }

        toast.success("Linked to document");
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
            {/* Note: Drag overlay removed for cleaner UX */}
            {initialData && (
                <Excalidraw
                    excalidrawAPI={handleSetExcalidrawAPI}
                    theme={resolvedTheme === "dark" ? "dark" : "light"}
                    initialData={initialData}
                    onChange={handleCanvasChange}
                    onLinkOpen={handleLinkOpen}
                />
            )}

            {/* Note: Canvas Binding Layer removed - using Excalidraw's native link indicators */}

            {/* 5. Connection Points Overlay (Canva-like) */}
            <ConnectionPointsOverlay excalidrawAPI={excalidrawAPI} containerRef={containerRef} />

            {/* Status Indicator (Enterprise Grade) */}
            {/* Status Indicator (Enterprise Grade) */}
            <CanvasStatusIndicator status={saveStatus} />
        </div>
    );
};

export const ExcalidrawCanvas = memo(ExcalidrawCanvasComponent);

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
