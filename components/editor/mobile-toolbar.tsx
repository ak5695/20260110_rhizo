"use client";

import { useEffect, useState, useRef } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
    Plus, Sparkles, Undo, Redo, Keyboard,
    Bold, Italic, Underline, Strikethrough, Code,
    Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Quote, Type, X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileToolbarProps {
    editor: any;
    onAiClick?: () => void;
}

export const MobileToolbar = ({ editor, onAiClick }: MobileToolbarProps) => {
    const isMobile = useMediaQuery("(max-width: 768px)");
    const [isFocused, setIsFocused] = useState(false);
    const [showBlockMenu, setShowBlockMenu] = useState(false);
    const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});

    // Track if we explicitly opened the menu to prevent auto-hiding
    const menuOpenRef = useRef(false);

    useEffect(() => {
        if (!editor || !isMobile) return;

        const updateState = () => {
            // If menu is open, we considered it "focused" for UI purposes even if keyboard is gone
            if (menuOpenRef.current) {
                setIsFocused(true);
                return;
            }

            const focused = editor.isFocused();
            setIsFocused(focused);

            if (focused) {
                const styles = editor.getActiveStyles();
                setActiveFormats({
                    bold: styles.bold,
                    italic: styles.italic,
                    underline: styles.underline,
                    strike: styles.strike,
                    code: styles.code,
                });
            }
        };

        const cleanup = editor.onSelectionChange(updateState);
        window.addEventListener('focus', updateState, true);
        window.addEventListener('blur', updateState, true);

        // Also listen for visual viewport resize (keyboard show/hide)
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', updateState);
        }

        updateState();

        return () => {
            cleanup();
            window.removeEventListener('focus', updateState, true);
            window.removeEventListener('blur', updateState, true);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', updateState);
            }
        };
    }, [editor, isMobile]);

    if (!isMobile || (!isFocused && !showBlockMenu)) return null;

    const toggleStyle = (style: string) => {
        editor?.toggleStyles({ [style]: true });
    };

    const insertBlock = (type: string, props?: any) => {
        const block = editor.getTextCursorPosition().block;
        if (!block) return;

        // Transform empty paragraph or insert new
        const isEmpty = block.type === "paragraph" && (!block.content || block.content.length === 0);

        if (isEmpty) {
            editor.updateBlock(block, { type, props });
        } else {
            editor.insertBlocks([{ type, props }], block, "after");
        }

        // Close menu and restore focus (bring back keyboard)
        setShowBlockMenu(false);
        menuOpenRef.current = false;

        // Small delay to allow UI to settle
        setTimeout(() => {
            editor.focus();
        }, 50);
    };

    const updateRemoteBlock = (block: any, type: string, props?: any) => {
        editor.updateBlock(block, { type, props });
    };

    const handleUndo = () => editor?._tiptapEditor?.commands.undo();
    const handleRedo = () => editor?._tiptapEditor?.commands.redo();

    const handleToggleMenu = () => {
        if (showBlockMenu) {
            // Close menu, return to keyboard
            setShowBlockMenu(false);
            menuOpenRef.current = false;
            editor.focus();
        } else {
            // Open menu, dismiss keyboard
            setShowBlockMenu(true);
            menuOpenRef.current = true;

            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }
        }
    };

    return (
        <>
            {/* Toolbar */}
            <div
                className={cn(
                    "fixed left-0 right-0 py-2 px-1 bg-background/95 border-t border-border/10 flex items-center justify-between z-[99999] shadow-[0_-4px_20px_rgba(0,0,0,0.1)] backdrop-blur-xl transition-all duration-300 ease-out",
                    // Move toolbar up when menu is open (assuming menu height ~250px)
                    // Actually, typical implementation keeps toolbar on top of menu or menu replaces keyboard
                    // Let's stick toolbar to bottom, and menu pushes it up? 
                    // Or Menu sits BEHIND toolbar?
                    // Notion approach: Toolbar sits ON TOP of the block options.
                    showBlockMenu ? "bottom-[280px]" : "bottom-0 safe-area-bottom pb-safe-offset-2"
                )}
                onPointerDown={(e) => {
                    e.preventDefault();
                }}
            >
                <div className="flex items-center gap-1 w-full overflow-x-auto no-scrollbar scroll-smooth px-2">
                    {/* Close Menu Button (replaces AI/Plus when open?) OR just visible */}
                    {/* Notion keeps the toolbar items mostly same */}

                    {/* Toggle Menu Button */}
                    <ToolbarButton
                        onClick={handleToggleMenu}
                        icon={<Plus className={cn("w-5 h-5 transition-transform", showBlockMenu && "rotate-45")} />}
                        active={showBlockMenu}
                    />

                    {/* AI Button */}
                    <ToolbarButton onClick={onAiClick} icon={<Sparkles className="w-5 h-5 text-purple-500 fill-purple-500/10" />} />

                    <div className="w-px h-5 bg-border/50 mx-1 flex-shrink-0" />

                    {/* Formatting */}
                    <ToolbarButton onClick={() => toggleStyle("bold")} icon={<Bold className="w-5 h-5" />} active={activeFormats.bold} />
                    <ToolbarButton onClick={() => toggleStyle("italic")} icon={<Italic className="w-5 h-5" />} active={activeFormats.italic} />
                    <ToolbarButton onClick={() => toggleStyle("underline")} icon={<Underline className="w-5 h-5" />} active={activeFormats.underline} />
                    <ToolbarButton onClick={() => toggleStyle("strike")} icon={<Strikethrough className="w-5 h-5" />} active={activeFormats.strike} />
                    <ToolbarButton onClick={() => toggleStyle("code")} icon={<Code className="w-5 h-5" />} active={activeFormats.code} />

                    {/* Headings Shortcuts (visible if space) */}
                    <div className="w-px h-5 bg-border/50 mx-1 flex-shrink-0" />
                    <ToolbarButton onClick={() => updateRemoteBlock(editor.getTextCursorPosition().block, "heading", { level: 1 })} icon={<Heading1 className="w-5 h-5" />} />
                    <ToolbarButton onClick={() => updateRemoteBlock(editor.getTextCursorPosition().block, "bulletListItem")} icon={<List className="w-5 h-5" />} />
                    <ToolbarButton onClick={() => updateRemoteBlock(editor.getTextCursorPosition().block, "checkListItem")} icon={<CheckSquare className="w-5 h-5" />} />


                    <div className="flex-1 min-w-[12px]" />

                    {/* Right aligned actions */}
                    <div className="flex items-center gap-1 pl-2 border-l border-border/50 sticky right-0 bg-background/95 backdrop-blur-xl shadow-[-10px_0_20px_rgba(0,0,0,0.05)_inset]">
                        <ToolbarButton onClick={handleUndo} icon={<Undo className="w-5 h-5" />} />
                        <ToolbarButton onClick={handleRedo} icon={<Redo className="w-5 h-5" />} />
                        <ToolbarButton onClick={() => {
                            setShowBlockMenu(false);
                            menuOpenRef.current = false;
                            if (document.activeElement instanceof HTMLElement) {
                                document.activeElement.blur();
                            }
                            setIsFocused(false);
                        }} icon={<Keyboard className="w-5 h-5 opacity-60" />} />
                    </div>
                </div>
            </div>

            {/* Block Options Panel */}
            <div
                className={cn(
                    "fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border/10 z-[99998] transition-transform duration-300 ease-in-out safe-area-bottom",
                    showBlockMenu ? "translate-y-0" : "translate-y-full"
                )}
                style={{ height: "280px" }}
                onPointerDown={(e) => {
                    e.preventDefault();
                }}
            >
                <div className="p-4 grid grid-cols-2 gap-3 h-full overflow-y-auto">
                    <BlockOption label="Text" icon={<Type className="w-4 h-4" />} onClick={() => insertBlock("paragraph")} />
                    <BlockOption label="Heading 1" icon={<Heading1 className="w-4 h-4" />} onClick={() => insertBlock("heading", { level: 1 })} />
                    <BlockOption label="Heading 2" icon={<Heading2 className="w-4 h-4" />} onClick={() => insertBlock("heading", { level: 2 })} />
                    <BlockOption label="Heading 3" icon={<Heading3 className="w-4 h-4" />} onClick={() => insertBlock("heading", { level: 3 })} />
                    <BlockOption label="Bullet List" icon={<List className="w-4 h-4" />} onClick={() => insertBlock("bulletListItem")} />
                    <BlockOption label="Numbered List" icon={<ListOrdered className="w-4 h-4" />} onClick={() => insertBlock("numberedListItem")} />
                    <BlockOption label="To-do List" icon={<CheckSquare className="w-4 h-4" />} onClick={() => insertBlock("checkListItem")} />
                    <BlockOption label="Quote" icon={<Quote className="w-4 h-4" />} onClick={() => insertBlock("paragraph")} />
                </div>
            </div>
        </>
    );
};

const ToolbarButton = ({ onClick, icon, active = false }: { onClick?: () => void, icon: React.ReactNode, active?: boolean }) => (
    <button
        onClick={(e) => {
            e.stopPropagation();
            onClick?.();
        }}
        className={cn(
            "rounded-md flex items-center justify-center transition-all active:scale-95 flex-shrink-0",
            "w-9 h-9",
            active ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
    >
        {icon}
    </button>
);

const BlockOption = ({ label, icon, onClick }: { label: string, icon: React.ReactNode, onClick: () => void }) => (
    <button
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
        className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/60 active:scale-95 transition-all text-sm font-medium text-foreground/80 border border-transparent hover:border-border/50"
    >
        <span className="p-2 bg-background rounded-md shadow-sm text-foreground">{icon}</span>
        {label}
    </button>
);

export default MobileToolbar;
