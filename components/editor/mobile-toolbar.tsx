"use client";

import { useEffect, useState, useRef } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
    Plus, Undo, Redo, Keyboard,
    Bold, Italic, Underline, Strikethrough, Code,
    Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Quote, Type,
    Trash2, Copy, Palette, Eraser
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileToolbarProps {
    editor: any;
    onAiClick?: () => void;
}

// Helper for haptic feedback
const vibrate = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(10); // Light tap
    }
};

export const MobileToolbar = ({ editor, onAiClick }: MobileToolbarProps) => {
    const isMobile = useMediaQuery("(max-width: 768px)");
    const [isFocused, setIsFocused] = useState(false);
    const [showBlockMenu, setShowBlockMenu] = useState(false);
    const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});
    const [menuTab, setMenuTab] = useState<"actions" | "colors">("actions");
    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

    // Track if we explicitly opened the menu to prevent auto-hiding
    const menuOpenRef = useRef(false);

    useEffect(() => {
        if (!editor || !isMobile) return;

        const updateState = () => {
            // If menu is open, we considered it "focused" for UI purposes
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

        const checkKeyboard = () => {
            if (window.visualViewport) {
                // Heuristic: If viewport height is significantly smaller than window height, keyboard is open
                // or if we have focus on a text input.
                // But specifically for 'floating with keyboard', we can rely on resize.
                const isKeyBoardLikelyOpen = window.visualViewport.height < window.innerHeight * 0.85;
                setIsKeyboardOpen(isKeyBoardLikelyOpen);
            }
        };

        const cleanup = editor.onSelectionChange(updateState);
        window.addEventListener('focus', updateState, true);
        window.addEventListener('blur', updateState, true);

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', checkKeyboard);
            window.visualViewport.addEventListener('resize', updateState);
            checkKeyboard();
        }

        updateState();

        return () => {
            cleanup();
            window.removeEventListener('focus', updateState, true);
            window.removeEventListener('blur', updateState, true);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', checkKeyboard);
                window.visualViewport.removeEventListener('resize', updateState);
            }
        };
    }, [editor, isMobile]);

    // Visibilty Condition: 
    // 1. Must be Mobile
    // 2. Either (Focused AND Keyboard Open) OR (Menu is explicitly Open)
    // 3. This ensures it doesn't show for Title input (editor.isFocused() will be false)
    const isVisible = isMobile && ((isFocused && isKeyboardOpen) || showBlockMenu);

    if (!isVisible) return null;

    const toggleStyle = (style: string) => {
        vibrate();
        editor?.toggleStyles({ [style]: true });
    };

    const updateRemoteBlock = (block: any, type: string, props?: any) => {
        vibrate();
        editor.updateBlock(block, { type, props });
        setShowBlockMenu(false);
        menuOpenRef.current = false;
        editor.focus();
    };

    const handleUndo = () => {
        vibrate();
        editor?._tiptapEditor?.commands.undo();
    };

    const handleRedo = () => {
        vibrate();
        editor?._tiptapEditor?.commands.redo();
    };

    const handleToggleMenu = () => {
        vibrate();
        if (showBlockMenu) {
            // Close menu, return to keyboard
            setShowBlockMenu(false);
            menuOpenRef.current = false;
            editor.focus();
        } else {
            // Open menu, dismiss keyboard
            setShowBlockMenu(true);
            menuOpenRef.current = true;
            setMenuTab("actions"); // Reset to actions tab

            // Force blur to dismiss keyboard
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }
        }
    };

    // Block Action Handlers
    const handleDeleteBlock = () => {
        vibrate();
        const block = editor.getTextCursorPosition().block;
        if (block) {
            editor.removeBlocks([block]);
            setShowBlockMenu(false);
            menuOpenRef.current = false;
            editor.focus();
        }
    };

    const handleDuplicateBlock = () => {
        vibrate();
        const block = editor.getTextCursorPosition().block;
        if (block) {
            const newBlock = {
                type: block.type,
                props: { ...block.props },
                content: block.content
            };
            editor.insertBlocks([newBlock], block, "after");
            setShowBlockMenu(false);
            menuOpenRef.current = false;
            editor.focus();
        }
    };

    return (
        <>
            {/* Toolbar Strip */}
            <div
                className={cn(
                    "fixed left-0 right-0 bg-white/95 dark:bg-zinc-900/95 border-t border-black/5 dark:border-white/5 flex items-center justify-between z-[99999] shadow-sm backdrop-blur-md transition-all duration-200 ease-out",
                    // Use standard padding, but minimal
                    "py-1.5 px-2",
                    // Stick to bottom. With 'interactive-widget: resizes-content', bottom-0 is on top of keyboard.
                    showBlockMenu ? "bottom-[340px]" : "bottom-0 safe-area-bottom"
                )}
                onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                }}
            >
                <div className="flex items-center gap-1 w-full overflow-x-auto no-scrollbar scroll-smooth">
                    {/* Toggle Menu Button */}
                    <ToolbarButton
                        onClick={handleToggleMenu}
                        icon={<Plus className={cn("w-5 h-5 transition-transform duration-200", showBlockMenu && "rotate-45")} />}
                        active={showBlockMenu}
                        variant="primary"
                    />

                    <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-1 flex-shrink-0" />

                    {/* Formatting - Compact */}
                    <div className="flex items-center gap-0.5">
                        <ToolbarButton onClick={() => toggleStyle("bold")} icon={<Bold className="w-4 h-4" />} active={activeFormats.bold} />
                        <ToolbarButton onClick={() => toggleStyle("italic")} icon={<Italic className="w-4 h-4" />} active={activeFormats.italic} />
                        <ToolbarButton onClick={() => toggleStyle("underline")} icon={<Underline className="w-4 h-4" />} active={activeFormats.underline} />
                        <ToolbarButton onClick={() => toggleStyle("strike")} icon={<Strikethrough className="w-4 h-4" />} active={activeFormats.strike} />
                        <ToolbarButton onClick={() => toggleStyle("code")} icon={<Code className="w-4 h-4" />} active={activeFormats.code} />
                    </div>

                    <div className="flex-1 min-w-[8px]" />

                    {/* Right aligned actions */}
                    <div className="flex items-center gap-0.5 pl-2 border-l border-black/10 dark:border-white/10 sticky right-0 bg-white/95 dark:bg-zinc-900/95">
                        <ToolbarButton onClick={handleUndo} icon={<Undo className="w-4 h-4" />} />
                        <ToolbarButton onClick={handleRedo} icon={<Redo className="w-4 h-4" />} />
                        <ToolbarButton onClick={() => {
                            setShowBlockMenu(false);
                            menuOpenRef.current = false;
                            if (document.activeElement instanceof HTMLElement) {
                                document.activeElement.blur();
                            }
                            setIsFocused(false);
                        }} icon={<Keyboard className="w-4 h-4" />} />
                    </div>
                </div>
            </div>

            {/* Block Options Sheet */}
            <div
                className={cn(
                    "fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 rounded-t-[16px] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] border-t border-black/5 dark:border-white/5 z-[99998] transition-transform duration-300 ease-in-out safe-area-bottom",
                    showBlockMenu ? "translate-y-0" : "translate-y-full"
                )}
                style={{ height: "340px" }}
                onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                }}
            >
                <div className="flex flex-col h-full">
                    {/* Drag Handle Indicator */}
                    <div className="w-full flex justify-center pt-3 pb-1">
                        <div className="w-8 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
                    </div>

                    {/* Tab Switcher */}
                    <div className="px-3 py-2 flex gap-2">
                        <button
                            onClick={() => { vibrate(); setMenuTab("actions"); }}
                            className={cn(
                                "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all",
                                menuTab === "actions"
                                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                                    : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                            )}
                        >
                            Blocks
                        </button>
                        <button
                            onClick={() => { vibrate(); setMenuTab("colors"); }}
                            className={cn(
                                "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all",
                                menuTab === "colors"
                                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                                    : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                            )}
                        >
                            Colors
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 pt-0">
                        {menuTab === "actions" ? (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                {/* Quick Actions Row */}
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={handleDuplicateBlock}
                                        className="flex items-center justify-center gap-2 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg font-medium text-xs active:scale-95 transition-transform border border-blue-100 dark:border-blue-900/30"
                                    >
                                        <Copy className="w-3.5 h-3.5" /> Duplicate
                                    </button>
                                    <button
                                        onClick={handleDeleteBlock}
                                        className="flex items-center justify-center gap-2 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg font-medium text-xs active:scale-95 transition-transform border border-red-100 dark:border-red-900/30"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Turn Into</h4>
                                    <div className="grid grid-cols-4 gap-2">
                                        <BlockOption label="Text" icon={<Type className="w-4 h-4" />} onClick={() => updateRemoteBlock(editor.getTextCursorPosition().block, "paragraph")} />
                                        <BlockOption label="H1" icon={<Heading1 className="w-4 h-4" />} onClick={() => updateRemoteBlock(editor.getTextCursorPosition().block, "heading", { level: 1 })} />
                                        <BlockOption label="H2" icon={<Heading2 className="w-4 h-4" />} onClick={() => updateRemoteBlock(editor.getTextCursorPosition().block, "heading", { level: 2 })} />
                                        <BlockOption label="H3" icon={<Heading3 className="w-4 h-4" />} onClick={() => updateRemoteBlock(editor.getTextCursorPosition().block, "heading", { level: 3 })} />
                                        <BlockOption label="Bullet" icon={<List className="w-4 h-4" />} onClick={() => updateRemoteBlock(editor.getTextCursorPosition().block, "bulletListItem")} />
                                        <BlockOption label="Number" icon={<ListOrdered className="w-4 h-4" />} onClick={() => updateRemoteBlock(editor.getTextCursorPosition().block, "numberedListItem")} />
                                        <BlockOption label="Todo" icon={<CheckSquare className="w-4 h-4" />} onClick={() => updateRemoteBlock(editor.getTextCursorPosition().block, "checkListItem")} />
                                        <BlockOption label="Quote" icon={<Quote className="w-4 h-4" />} onClick={() => updateRemoteBlock(editor.getTextCursorPosition().block, "blockquote")} />
                                        <BlockOption label="Code" icon={<Code className="w-4 h-4" />} onClick={() => updateRemoteBlock(editor.getTextCursorPosition().block, "codeBlock")} />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-200">
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Text Color</h4>
                                    <div className="grid grid-cols-5 gap-2">
                                        <ColorSwatch color="default" editor={editor} />
                                        <ColorSwatch color="gray" editor={editor} />
                                        <ColorSwatch color="brown" editor={editor} />
                                        <ColorSwatch color="orange" editor={editor} />
                                        <ColorSwatch color="yellow" editor={editor} />
                                        <ColorSwatch color="green" editor={editor} />
                                        <ColorSwatch color="blue" editor={editor} />
                                        <ColorSwatch color="purple" editor={editor} />
                                        <ColorSwatch color="pink" editor={editor} />
                                        <ColorSwatch color="red" editor={editor} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Background</h4>
                                    <div className="grid grid-cols-5 gap-2">
                                        <ColorSwatch color="default" type="background" editor={editor} />
                                        <ColorSwatch color="gray" type="background" editor={editor} />
                                        <ColorSwatch color="brown" type="background" editor={editor} />
                                        <ColorSwatch color="orange" type="background" editor={editor} />
                                        <ColorSwatch color="yellow" type="background" editor={editor} />
                                        <ColorSwatch color="green" type="background" editor={editor} />
                                        <ColorSwatch color="blue" type="background" editor={editor} />
                                        <ColorSwatch color="purple" type="background" editor={editor} />
                                        <ColorSwatch color="pink" type="background" editor={editor} />
                                        <ColorSwatch color="red" type="background" editor={editor} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

const ToolbarButton = ({ onClick, icon, active = false, variant = "default" }: { onClick?: () => void, icon: React.ReactNode, active?: boolean, variant?: "default" | "primary" }) => (
    <button
        onClick={(e) => {
            e.stopPropagation();
            vibrate();
            onClick?.();
        }}
        className={cn(
            "rounded-md flex items-center justify-center transition-all duration-75 active:scale-90 active:bg-zinc-200 dark:active:bg-zinc-700 flex-shrink-0",
            "w-8 h-8",
            active
                ? (variant === "primary" ? "bg-black text-white dark:bg-white dark:text-black shadow-sm" : "bg-black/10 dark:bg-white/10 text-black dark:text-white")
                : "text-zinc-500 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white"
        )}
    >
        {icon}
    </button>
);

const BlockOption = ({ label, icon, onClick }: { label: string, icon: React.ReactNode, onClick: () => void }) => (
    <button
        onClick={(e) => {
            e.stopPropagation();
            vibrate();
            onClick();
        }}
        className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/30 active:scale-95 active:bg-zinc-200 dark:active:bg-zinc-700 transition-all duration-75 text-[10px] font-medium text-zinc-600 dark:text-zinc-300 h-16"
    >
        <div className="p-1.5 bg-white dark:bg-zinc-700 rounded-md shadow-sm text-zinc-900 dark:text-zinc-100 border border-black/5 dark:border-white/5">
            {icon}
        </div>
        <span className="truncate w-full text-center">{label}</span>
    </button>
);

const ColorSwatch = ({ color, type = "text", editor }: { color: string, type?: "text" | "background", editor: any }) => {
    const isDefault = color === "default";
    const mapColorToTailwind = (c: string) => {
        switch (c) {
            case "gray": return "bg-zinc-500";
            case "brown": return "bg-stone-500";
            case "orange": return "bg-orange-500";
            case "yellow": return "bg-yellow-500";
            case "green": return "bg-green-500";
            case "blue": return "bg-blue-500";
            case "purple": return "bg-purple-500";
            case "pink": return "bg-pink-500";
            case "red": return "bg-red-500";
            default: return "bg-zinc-900 dark:bg-zinc-100";
        }
    };

    return (
        <button
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                vibrate();
                const block = editor.getTextCursorPosition().block;
                if (!block) return;
                const propsKey = type === "text" ? "textColor" : "backgroundColor";
                editor.updateBlock(block, { props: { [propsKey]: color } });

                // CRITICAL FIX: Force blur to prevent keyboard summons on mobile
                // The editor might try to regain focus after update
                if (window.innerWidth <= 768) {
                    setTimeout(() => {
                        if (document.activeElement instanceof HTMLElement) {
                            document.activeElement.blur();
                        }
                    }, 0);
                }
            }}
            className={cn(
                "h-8 w-full rounded-lg flex items-center justify-center transition-all duration-75 active:scale-90 active:ring-2 active:ring-zinc-400 dark:active:ring-zinc-600 border",
                type === "background"
                    ? cn("border-transparent shadow-sm", isDefault ? "bg-white border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700" : mapColorToTailwind(color).replace("bg-", "bg-opacity-20 bg-"))
                    : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
            )}
        >
            {type === "text" ? (
                <span className={cn(
                    "text-xs font-bold",
                    isDefault ? "text-zinc-900 dark:text-white" : mapColorToTailwind(color).replace("bg-", "text-")
                )}>
                    A
                </span>
            ) : (
                isDefault ? <Eraser className="w-3 h-3 text-zinc-400" /> : <div className={cn("w-2.5 h-2.5 rounded-full", mapColorToTailwind(color))} />
            )}
        </button>
    )
};

export default MobileToolbar;
