/**
 * Connection Points Overlay for Excalidraw
 * 
 * Shows connection handles on selected elements for easy arrow creation
 * Similar to Canva/Draw.io experience
 * 
 * Behavior:
 * 1. Select an element
 * 2. Click a connection point
 * 3. Arrow follows the mouse (rubber-band)
 * 4. Click to confirm endpoint
 * 5. Auto-switch back to selection mode
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

interface ConnectionPoint {
    position: "top" | "right" | "bottom" | "left";
    x: number;
    y: number;
    canvasX: number;
    canvasY: number;
}

interface ConnectionPointsOverlayProps {
    excalidrawAPI: any;
    containerRef: React.RefObject<HTMLDivElement>;
}

export const ConnectionPointsOverlay = ({ excalidrawAPI, containerRef }: ConnectionPointsOverlayProps) => {
    const [selectedElement, setSelectedElement] = useState<any>(null);
    const [connectionPoints, setConnectionPoints] = useState<ConnectionPoint[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawingArrow, setDrawingArrow] = useState<any>(null);
    const [startPoint, setStartPoint] = useState<ConnectionPoint | null>(null);
    const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
    const rafRef = useRef<number>();
    const sourceElementRef = useRef<any>(null);

    // Calculate connection points for a selected element
    const calculateConnectionPoints = useCallback((element: any, appState: any): ConnectionPoint[] => {
        if (!element || !containerRef.current) return [];

        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();

        const { scrollX, scrollY, zoom } = appState;
        const zoomValue = zoom?.value || 1;

        // Element bounds in canvas coordinates
        const elCenterX = element.x + element.width / 2;
        const elCenterY = element.y + element.height / 2;

        // Convert to screen coordinates
        const screenX = (elCenterX + scrollX) * zoomValue;
        const screenY = (elCenterY + scrollY) * zoomValue;

        const halfWidth = (element.width / 2) * zoomValue;
        const halfHeight = (element.height / 2) * zoomValue;

        const canvasEl = container.querySelector('.excalidraw');
        if (!canvasEl) return [];
        const canvasRect = canvasEl.getBoundingClientRect();
        const offsetX = canvasRect.left - containerRect.left;
        const offsetY = canvasRect.top - containerRect.top;

        return [
            {
                position: "top",
                x: screenX + offsetX,
                y: screenY - halfHeight + offsetY,
                canvasX: elCenterX,
                canvasY: element.y
            },
            {
                position: "right",
                x: screenX + halfWidth + offsetX,
                y: screenY + offsetY,
                canvasX: element.x + element.width,
                canvasY: elCenterY
            },
            {
                position: "bottom",
                x: screenX + offsetX,
                y: screenY + halfHeight + offsetY,
                canvasX: elCenterX,
                canvasY: element.y + element.height
            },
            {
                position: "left",
                x: screenX - halfWidth + offsetX,
                y: screenY + offsetY,
                canvasX: element.x,
                canvasY: elCenterY
            },
        ];
    }, [containerRef]);

    // Update overlay positions
    const updateOverlay = useCallback(() => {
        if (!excalidrawAPI || isDrawing) {
            rafRef.current = requestAnimationFrame(updateOverlay);
            return;
        }

        const appState = excalidrawAPI.getAppState();
        const selectedIds = Object.keys(appState.selectedElementIds || {});

        if (selectedIds.length === 1) {
            const elements = excalidrawAPI.getSceneElements();
            const selected = elements.find((el: any) => el.id === selectedIds[0] && !el.isDeleted);

            if (selected && !["arrow", "line", "freedraw"].includes(selected.type)) {
                setSelectedElement(selected);
                setConnectionPoints(calculateConnectionPoints(selected, appState));
            } else {
                setSelectedElement(null);
                setConnectionPoints([]);
            }
        } else {
            setSelectedElement(null);
            setConnectionPoints([]);
        }

        rafRef.current = requestAnimationFrame(updateOverlay);
    }, [excalidrawAPI, calculateConnectionPoints, isDrawing]);

    useEffect(() => {
        updateOverlay();
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [updateOverlay]);

    // Convert screen coordinates to canvas coordinates
    const screenToCanvas = useCallback((screenX: number, screenY: number) => {
        if (!excalidrawAPI || !containerRef.current) return { x: 0, y: 0 };

        const appState = excalidrawAPI.getAppState();
        const { scrollX, scrollY, zoom } = appState;
        const zoomValue = zoom?.value || 1;

        const container = containerRef.current;
        const canvasEl = container.querySelector('.excalidraw');
        if (!canvasEl) return { x: 0, y: 0 };

        const canvasRect = canvasEl.getBoundingClientRect();

        const relativeX = screenX - canvasRect.left;
        const relativeY = screenY - canvasRect.top;

        const canvasX = relativeX / zoomValue - scrollX;
        const canvasY = relativeY / zoomValue - scrollY;

        return { x: canvasX, y: canvasY };
    }, [excalidrawAPI, containerRef]);

    // Start drawing arrow from connection point
    const handleConnectionClick = useCallback((point: ConnectionPoint, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        if (!excalidrawAPI || !selectedElement) return;

        sourceElementRef.current = selectedElement;
        setStartPoint(point);
        setIsDrawing(true);
        setMousePos({ x: e.clientX, y: e.clientY });

        console.log("[ConnectionPoints] Started drawing from:", point.position);
    }, [excalidrawAPI, selectedElement]);

    // Handle mouse move during drawing
    useEffect(() => {
        if (!isDrawing || !startPoint) return;

        const handleMouseMove = (e: MouseEvent) => {
            setMousePos({ x: e.clientX, y: e.clientY });
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (!excalidrawAPI || !startPoint || !sourceElementRef.current) {
                setIsDrawing(false);
                setStartPoint(null);
                setMousePos(null);
                return;
            }

            const endPos = screenToCanvas(e.clientX, e.clientY);
            const appState = excalidrawAPI.getAppState();

            // Find if we're clicking on another element
            const elements = excalidrawAPI.getSceneElements();
            let targetElement: any = null;
            let endBinding = null;

            for (const el of elements) {
                if (el.isDeleted || el.id === sourceElementRef.current.id) continue;
                if (["arrow", "line", "freedraw"].includes(el.type)) continue;

                // Simple hit test
                if (endPos.x >= el.x && endPos.x <= el.x + el.width &&
                    endPos.y >= el.y && endPos.y <= el.y + el.height) {
                    targetElement = el;
                    endBinding = {
                        elementId: el.id,
                        focus: 0,
                        gap: 1,
                    };
                    break;
                }
            }

            // Create the arrow
            const arrowId = `arrow-${Date.now()}`;
            const dx = endPos.x - startPoint.canvasX;
            const dy = endPos.y - startPoint.canvasY;

            const startBinding = {
                elementId: sourceElementRef.current.id,
                focus: 0,
                gap: 1,
            };

            const arrow = {
                id: arrowId,
                type: "arrow",
                x: startPoint.canvasX,
                y: startPoint.canvasY,
                width: Math.abs(dx),
                height: Math.abs(dy),
                angle: 0,
                strokeColor: appState.currentItemStrokeColor || "#1e1e1e",
                backgroundColor: "transparent",
                fillStyle: "solid",
                strokeWidth: 2,
                strokeStyle: "solid",
                roughness: 1,
                opacity: 100,
                groupIds: [],
                frameId: null,
                roundness: { type: 2 },
                seed: Math.floor(Math.random() * 100000),
                version: 1,
                versionNonce: Math.floor(Math.random() * 100000),
                isDeleted: false,
                boundElements: null,
                updated: Date.now(),
                locked: false,
                points: [[0, 0], [dx, dy]],
                lastCommittedPoint: [dx, dy],
                startBinding: startBinding,
                endBinding: endBinding,
                startArrowhead: null,
                endArrowhead: "arrow",
            };

            // Update elements with proper bindings
            const updatedElements = elements.map((el: any) => {
                // Update source element's boundElements
                if (el.id === sourceElementRef.current.id) {
                    const existingBoundElements = el.boundElements || [];
                    return {
                        ...el,
                        boundElements: [
                            ...existingBoundElements.filter((b: any) => b.id !== arrowId),
                            { id: arrowId, type: "arrow" }
                        ],
                        version: el.version + 1,
                        versionNonce: Math.floor(Math.random() * 100000),
                    };
                }

                // Update target element's boundElements (if exists)
                if (targetElement && el.id === targetElement.id) {
                    const existingBoundElements = el.boundElements || [];
                    return {
                        ...el,
                        boundElements: [
                            ...existingBoundElements.filter((b: any) => b.id !== arrowId),
                            { id: arrowId, type: "arrow" }
                        ],
                        version: el.version + 1,
                        versionNonce: Math.floor(Math.random() * 100000),
                    };
                }

                return el;
            });

            // Add arrow and switch back to selection tool
            excalidrawAPI.updateScene({
                elements: [...updatedElements, arrow],
                appState: {
                    ...appState,
                    activeTool: { type: "selection" },
                    selectedElementIds: { [arrowId]: true },
                }
            });

            console.log("[ConnectionPoints] Created bound arrow:", {
                arrowId,
                startBinding: startBinding.elementId,
                endBinding: endBinding?.elementId || "none"
            });

            // Reset state
            setIsDrawing(false);
            setStartPoint(null);
            setMousePos(null);
            sourceElementRef.current = null;
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsDrawing(false);
                setStartPoint(null);
                setMousePos(null);
                sourceElementRef.current = null;
            }
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isDrawing, startPoint, excalidrawAPI, screenToCanvas]);

    // Render rubber-band line during drawing
    const renderDrawingLine = () => {
        if (!isDrawing || !startPoint || !mousePos || !containerRef.current) return null;

        return (
            <svg className="absolute inset-0 pointer-events-none z-50" style={{ overflow: "visible" }}>
                <line
                    x1={startPoint.x}
                    y1={startPoint.y}
                    x2={mousePos.x - containerRef.current.getBoundingClientRect().left}
                    y2={mousePos.y - containerRef.current.getBoundingClientRect().top}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    markerEnd="url(#arrowhead)"
                />
                <defs>
                    <marker
                        id="arrowhead"
                        markerWidth="10"
                        markerHeight="7"
                        refX="9"
                        refY="3.5"
                        orient="auto"
                    >
                        <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
                    </marker>
                </defs>
            </svg>
        );
    };

    // Don't show connection points while drawing
    if (isDrawing) {
        return (
            <div className="absolute inset-0 pointer-events-none z-40">
                {renderDrawingLine()}
                {/* Hint text */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg pointer-events-none">
                    点击确定终点 • 按 Esc 取消
                </div>
            </div>
        );
    }

    if (connectionPoints.length === 0) return null;

    return (
        <div className="absolute inset-0 pointer-events-none z-40">
            {connectionPoints.map((point) => (
                <button
                    key={point.position}
                    className={cn(
                        "absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2",
                        "pointer-events-auto cursor-crosshair",
                        "bg-blue-500 hover:bg-blue-600 border-2 border-white",
                        "rounded-full shadow-lg",
                        "transition-all duration-150",
                        "hover:scale-125 hover:shadow-blue-500/50",
                        "flex items-center justify-center",
                        "opacity-80 hover:opacity-100"
                    )}
                    style={{
                        left: point.x,
                        top: point.y,
                    }}
                    onMouseDown={(e) => handleConnectionClick(point, e)}
                    title={`从${point.position === "top" ? "上" : point.position === "right" ? "右" : point.position === "bottom" ? "下" : "左"}边创建连线`}
                >
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </button>
            ))}
        </div>
    );
};
