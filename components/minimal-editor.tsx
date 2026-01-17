"use client";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@blocknote/core/fonts/inter.css";
import { useTheme } from "next-themes";

interface MinimalEditorProps {
    initialContent?: string;
    onChange?: (value: string) => void;
}

export const MinimalEditor = ({ initialContent, onChange }: MinimalEditorProps) => {
    const { resolvedTheme } = useTheme();

    const editor = useCreateBlockNote({
        initialContent: initialContent ? JSON.parse(initialContent) : undefined,
    });

    return (
        <div className="bg-white dark:bg-[#1F1F1F] min-h-screen p-20">
            <BlockNoteView
                editor={editor}
                theme={resolvedTheme === "dark" ? "dark" : "light"}
                onChange={() => {
                    if (onChange) {
                        onChange(JSON.stringify(editor.document));
                    }
                }}
            />
        </div>
    );
};
