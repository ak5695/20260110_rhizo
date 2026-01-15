"use client";

import { useNavigationStore } from "@/store/use-navigation-store";
import { useEffect, useState } from "react";

/**
 * Editor Overlay for Binding Indicators (Enterprise Grade)
 * Independent rendering layer to avoid fighting with BlockNote's DOM management.
 */
export const EditorBindingOverlay = ({ bindings, editor, jumpToElement, activeBlockId }: { bindings: any[], editor: any, jumpToElement: (id: string) => void, activeBlockId?: string }) => {
    const [markers, setMarkers] = useState<any[]>([]);


    // Using ResizeObserver on the editor container to detect layout shifts
    useEffect(() => {
        if (!editor || !bindings.length) {
            setMarkers([]);
            return;
        }

        const updateMarkers = () => {
            // Find the editor container for relative positioning
            const container = document.querySelector('.group\\/editor');
            if (!container) return;
            const containerRect = container.getBoundingClientRect();

            const newMarkers = bindings.map(binding => {
                // Ghost Check: Intelligent hide based on source of truth
                // We rely entirely on the store's optimistic status ('hidden', 'deleted', etc.)
                // which is now updated instantly by excalidraw-canvas.
                const isGhost = binding.status === "deleted" || binding.status === "hidden";

                if (isGhost) return null;

                // Find visible block element
                const el = document.querySelector(`[data-id="${binding.blockId}"]`);
                if (!el) return null;

                let top = 0;
                let height = 0;
                let left = 0;
                let width = 0; // needed for inline positioning
                let isInline = false;

                // 1. Try to find inline text binding
                const textSpan = el.querySelector('.canvas-bound-text');
                if (textSpan) {
                    const spanRect = textSpan.getBoundingClientRect();
                    top = spanRect.top - containerRect.top;
                    height = spanRect.height;
                    left = spanRect.left - containerRect.left;
                    width = spanRect.width;
                    isInline = true;
                } else {
                    // 2. Fallback to Block Level
                    const blockRect = el.getBoundingClientRect();
                    top = blockRect.top - containerRect.top;
                    height = blockRect.height;
                    left = 0;
                    width = blockRect.width;
                }

                return {
                    id: binding.id,
                    blockId: binding.blockId,
                    elementId: binding.elementId,
                    top,
                    height,
                    left,
                    width,
                    isInline
                };
            }).filter(Boolean);

            // Deep comparison to prevent infinite loop
            // RAF -> State Update -> Render -> RAF -> ...
            setMarkers(prevMarkers => {
                const isSame = prevMarkers.length === newMarkers.length && prevMarkers.every((m, i) => {
                    const nm = newMarkers[i];
                    return m.id === nm?.id &&
                        Math.abs(m.top - (nm?.top || 0)) < 1 && // Sub-pixel tolerance
                        Math.abs(m.height - (nm?.height || 0)) < 1 &&
                        Math.abs(m.left - (nm?.left || 0)) < 1 &&
                        Math.abs(m.width - (nm?.width || 0)) < 1 &&
                        m.isInline === nm?.isInline;
                });

                return isSame ? prevMarkers : newMarkers;
            });
        };

        // Update loop
        let rafId: number;
        const loop = () => {
            updateMarkers();
            rafId = requestAnimationFrame(loop);
        };
        loop();

        return () => cancelAnimationFrame(rafId);
    }, [bindings, editor]);

    if (!markers.length) return null;

    return (
        <div className="absolute inset-0 pointer-events-none z-10">
            {markers.map((m: any) => {
                const isActive = activeBlockId === m.blockId;

                return (
                    <div
                        key={m.id}
                        style={{
                            top: m.top,
                            height: m.height,
                            left: m.isInline ? m.left : 0,
                            right: m.isInline ? 'auto' : 0,
                            width: m.isInline ? m.width : 'auto'
                        }}
                        className={`absolute transition-all duration-75 ${isActive ? 'z-20' : 'z-10'}`}
                    >
                        {/* Spotlight Effect */}
                        {isActive && (
                            <div className={`absolute inset-0 bg-red-500/10 border-orange-500 animate-pulse shadow-[0_0_30px_rgba(249,115,22,0.15)] ${m.isInline ? 'rounded border-b-2' : 'border-l-4 rounded-r-md'}`} />
                        )}

                        {/* Visual Gutter Line (Normal State) - Block Only */}
                        {!isActive && !m.isInline && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-600 rounded-r shadow-[0_0_8px_rgba(249,115,22,0.4)] opacity-80" />
                        )}

                        {/* Interactive Icon */}
                        <div
                            className={`absolute cursor-pointer pointer-events-auto flex items-center justify-center text-orange-500 w-6 h-6 hover:scale-110 hover:bg-orange-50 hover:border-orange-500 transition-all z-50 ${isActive ? 'ring-2 ring-orange-400 scale-110' : ''}`}
                            style={m.isInline ? {
                                left: '0%',
                                top: '50%',
                                marginTop: '-4px',
                                marginLeft: '4px'
                            } : {
                                right: 0,
                                top: -12
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                jumpToElement(m.elementId);
                            }}
                            title="Jump to Canvas"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                        </div>
                    </div>
                )
            })}
        </div>
    );
};
