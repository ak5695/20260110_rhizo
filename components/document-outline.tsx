"use client";

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { List, ChevronRight, X } from "lucide-react";
import { useEditorDocument } from "@/store/use-layout-store";

interface HeadingItem {
  id: string;
  level: number; // 1, 2, or 3 for H1, H2, H3
  text: string;
}

interface DocumentOutlineProps {
  className?: string; // Removed editorDocument prop
  onClose?: () => void;
}

export const DocumentOutline = ({ className, onClose }: DocumentOutlineProps) => { // Removed editorDocument prop
  const editorDocument = useEditorDocument();
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);

  // Extract headings from BlockNote document
  const headings = useMemo(() => {
    if (!editorDocument || !Array.isArray(editorDocument)) return [];

    const result: HeadingItem[] = [];

    editorDocument.forEach((block: any) => {
      if (block.type === "heading") {
        const level = block.props?.level || 1;
        let text = "";

        // Extract text from block content
        if (Array.isArray(block.content)) {
          text = block.content
            .map((c: any) => (c.type === "text" ? c.text : ""))
            .join("");
        }

        if (text.trim()) {
          result.push({
            id: block.id,
            level,
            text: text.trim(),
          });
        }
      }
    });

    return result;
  }, [editorDocument]);

  // Scroll to heading when clicked
  const scrollToHeading = (headingId: string) => {
    // Find the block element by ID
    const blockElement = document.querySelector(`[data-id="${headingId}"]`);

    if (blockElement) {
      blockElement.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveHeadingId(headingId);

      // Visual feedback: flash the heading
      (blockElement as HTMLElement).animate(
        [
          { backgroundColor: "rgba(168, 85, 247, 0.2)", transform: "scale(1.01)" },
          { backgroundColor: "transparent", transform: "scale(1)" },
        ],
        { duration: 600, easing: "ease-out" }
      );
    }
  };

  // Track scroll position to highlight active heading
  useEffect(() => {
    const handleScroll = () => {
      const headingElements = headings.map((h) =>
        document.querySelector(`[data-id="${h.id}"]`)
      );

      let currentHeading: string | null = null;

      // Find the heading that's currently visible at the top of the viewport
      for (let i = headingElements.length - 1; i >= 0; i--) {
        const element = headingElements[i];
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 100) {
            currentHeading = headings[i].id;
            break;
          }
        }
      }

      setActiveHeadingId(currentHeading);
    };

    const editorContainer = document.querySelector(".bn-container");
    if (editorContainer) {
      editorContainer.addEventListener("scroll", handleScroll);
      return () => editorContainer.removeEventListener("scroll", handleScroll);
    }
  }, [headings]);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <List className="h-4 w-4" />
          <span>Table of Contents</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted/80 rounded-md transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close outline"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {headings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2 text-muted-foreground">
            <List className="h-8 w-8 opacity-30" />
            <p className="text-xs">No headings found</p>
            <p className="text-[10px] opacity-60">Add headings to see the outline</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 p-2">
            {headings.map((heading) => {
              const isActive = activeHeadingId === heading.id;
              const indent = (heading.level - 1) * 12; // 12px per level

              return (
                <button
                  key={heading.id}
                  onClick={() => scrollToHeading(heading.id)}
                  className={cn(
                    "group flex items-start gap-2 px-2 py-1.5 rounded-lg text-left transition-all",
                    "hover:bg-muted/50 dark:hover:bg-white/5",
                    isActive && "bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400"
                  )}
                  style={{ paddingLeft: `${8 + indent}px` }}
                >
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 flex-shrink-0 mt-0.5 transition-all",
                      isActive ? "opacity-100 text-purple-500" : "opacity-0 group-hover:opacity-50"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm leading-tight line-clamp-2 transition-colors",
                      heading.level === 1 && "font-semibold",
                      heading.level === 2 && "font-medium",
                      heading.level === 3 && "font-normal text-muted-foreground",
                      isActive && "font-semibold"
                    )}
                  >
                    {heading.text}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
