"use client";

import { useEffect, useState } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useTheme } from "next-themes";

const LANGUAGES = [
    { value: "javascript", label: "JavaScript" },
    { value: "typescript", label: "TypeScript" },
    { value: "python", label: "Python" },
    { value: "java", label: "Java" },
    { value: "c", label: "C" },
    { value: "cpp", label: "C++" },
    { value: "csharp", label: "C#" },
    { value: "go", label: "Go" },
    { value: "rust", label: "Rust" },
    { value: "css", label: "CSS" },
    { value: "html", label: "HTML" },
    { value: "json", label: "JSON" },
    { value: "sql", label: "SQL" },
    { value: "shell", label: "Shell" },
    { value: "markdown", label: "Markdown" },
    { value: "plaintext", label: "Plain Text" },
];

interface CodeBlockLanguageSelectorProps {
    editor: any;
}

const CodeBlockLanguageSelector = ({ editor }: CodeBlockLanguageSelectorProps) => {
    const [position, setPosition] = useState<React.CSSProperties | null>(null);
    const [currentLanguage, setCurrentLanguage] = useState("plaintext");
    const [blockId, setBlockId] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!editor) return;

        const update = () => {
            const selection = editor.getSelection();
            let block: any = null;
            if (selection) block = selection.blocks[0];
            else block = editor.getTextCursorPosition().block;

            if (block && block.type === "codeBlock") {
                const domEl = document.querySelector(`[data-id="${block.id}"]`);
                const container = document.querySelector('.group\\/editor');

                if (domEl && container) {
                    const blockRect = domEl.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();

                    setPosition({
                        top: blockRect.top - containerRect.top + 8,
                        right: containerRect.right - blockRect.right + 8, // Relative to container right
                        // But wait, if container is wider than window?
                        // Let's stick to 'left' based absolute
                        left: blockRect.right - containerRect.left - 120 - 8, // 120px width, 8px padding
                        width: 120
                    });
                    setBlockId(block.id);
                    // Get current language from props - BlockNote stores it in props
                    // Note: Default schema might strictly use 'language' or specific prop
                    // BlockNote default code block prop is 'language'
                    setCurrentLanguage(block.props.language || "typescript"); // Default usually undefined?
                    return;
                }
            }
            // Only hide if menu is NOT open (to prevent closing when clicking the select)
            // But Select is a radical popup, so interacting with it might blur editor?
            // Actually Radix Select effectively manages focus.
            if (!isOpen) {
                setPosition(null);
                setBlockId(null);
            }
        };

        const cleanup = editor.onSelectionChange(update);
        // Also listen to scroll to update position? 
        // Real-time update loop
        let rafId: number;
        const loop = () => {
            // Only update position if we have a target, to follow scroll
            if (blockId) update();
            rafId = requestAnimationFrame(loop);
        };
        // loop(); 
        // Standard selection change is usually enough unless scrolling
        document.addEventListener('scroll', update, true);

        return () => {
            cleanup();
            document.removeEventListener('scroll', update, true);
            // cancelAnimationFrame(rafId);
        };
    }, [editor, blockId, isOpen]);

    if (!position || !blockId) return null;

    const handleLanguageChange = (val: string) => {
        if (blockId) {
            editor.updateBlock(blockId, {
                props: { language: val }
            });
            setCurrentLanguage(val);
        }
    };

    return (
        <div className="absolute z-20" style={position}>
            <Select
                value={currentLanguage}
                onValueChange={handleLanguageChange}
                onOpenChange={setIsOpen}
            >
                <SelectTrigger className="h-6 text-[10px] bg-muted/80 backdrop-blur-sm border-transparent hover:bg-muted focus:ring-0 gap-1 w-[120px] justify-between px-2">
                    <span className="truncate">{LANGUAGES.find(l => l.value === currentLanguage)?.label || "Plain Text"}</span>
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                    {LANGUAGES.map(lang => (
                        <SelectItem key={lang.value} value={lang.value} className="text-xs">
                            {lang.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

export default CodeBlockLanguageSelector;
