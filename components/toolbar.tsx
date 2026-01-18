"use client";

import React, { ElementRef, useRef, useState, useCallback, useEffect } from "react";
import { IconPicker } from "@/components/icon-picker";
import { Button } from "@/components/ui/button";
import { ImageIcon, Smile, X, Loader2, Sparkles, Check } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { useCoverImage } from "@/hooks/use-cover-image";
import { useDocumentStore, useDocumentTitle, useDocumentIcon } from "@/store/use-document-store";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

// Default placeholder text for new pages
const PLACEHOLDER_TITLE = "Untitled";

interface ToolbarProps {
  initialData: any; // Type adaptation
  preview?: boolean;
}

export const Toolbar = ({ initialData, preview }: ToolbarProps) => {
  const inputRef = useRef<ElementRef<"textarea">>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "pending" | "saving">("idle");

  // AI Title Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Listen for write queue status updates
  useEffect(() => {
    const handleStatus = (e: any) => {
      if (e.detail?.documentId === initialData.id) {
        setSaveStatus(e.detail.status);
      }
    };
    window.addEventListener("write-queue-status", handleStatus as EventListener);
    return () => window.removeEventListener("write-queue-status", handleStatus as EventListener);
  }, [initialData.id]);

  // Use Zustand store for real-time sync
  const { setDocument, updateTitle, updateIcon } = useDocumentStore();
  const storeTitle = useDocumentTitle(initialData.id);
  const storeIcon = useDocumentIcon(initialData.id);

  // Initialize store with initial data (only runs once per document)
  useEffect(() => {
    setDocument({
      id: initialData.id,
      title: initialData.title,
      icon: initialData.icon,
      version: initialData.version,
      userId: initialData.userId,
      parentDocumentId: initialData.parentDocumentId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData.id]); // Only re-init when document ID changes

  // Use store value or fallback to initialData
  const rawTitle = storeTitle ?? initialData.title;
  const icon = storeIcon !== undefined ? storeIcon : initialData.icon;

  // Check if title is placeholder (empty, "Untitled", or undefined)
  const isPlaceholder = !rawTitle || rawTitle === PLACEHOLDER_TITLE;
  const displayTitle = isPlaceholder ? PLACEHOLDER_TITLE : rawTitle;

  const coverImage = useCoverImage();

  const enableInput = () => {
    if (preview) return;
    setIsEditing(true);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        // If it's a placeholder, select all text for easy replacement
        if (isPlaceholder) {
          inputRef.current.select();
        }
      }
    }, 0);
  };

  const disableInput = () => setIsEditing(false);

  // Real-time title update via Zustand store
  const onInput = useCallback((newTitle: string) => {
    updateTitle(initialData.id, newTitle);
  }, [initialData.id, updateTitle]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      disableInput();
      // Dispatch custom event to focus editor
      window.dispatchEvent(new CustomEvent("editor:focus"));
    }
  };

  // Icon changes via Zustand store
  const onIconSelect = useCallback((newIcon: string) => {
    updateIcon(initialData.id, newIcon);
  }, [initialData.id, updateIcon]);

  const onRemoveIcon = useCallback(() => {
    updateIcon(initialData.id, null);
  }, [initialData.id, updateIcon]);

  // AI Title Generation
  const onGenerateTitle = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setGeneratedTitle("");

    try {
      // 1. Extract text from content
      let textContent = "";
      try {
        if (initialData.content) {
          const blocks = JSON.parse(initialData.content);
          for (const block of blocks) {
            if (block.content && Array.isArray(block.content)) {
              for (const item of block.content) {
                if (item.type === "text") {
                  textContent += (item.text || "") + " ";
                }
              }
            }
            if (textContent.length > 1000) break; // Optimization
          }
        }
      } catch (e) {
        console.error("Failed to parse content for title generation", e);
      }

      const finalText = textContent.slice(0, 500).trim();

      if (!finalText) {
        toast.error("Document is empty. Write something first!");
        setIsGenerating(false);
        return;
      }

      // 2. Call API
      const response = await fetch("/api/generate-title", {
        method: "POST",
        body: JSON.stringify({ content: finalText }),
      });

      if (!response.ok) throw new Error("Failed to generate title");

      const data = await response.json();
      setGeneratedTitle(data.title);
      setIsPopoverOpen(true);
    } catch (error) {
      toast.error("Failed to generate title");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const applyGeneratedTitle = () => {
    onInput(generatedTitle);
    setIsPopoverOpen(false);
    toast.success("Title updated!");
  };

  // No more mode switching - Always editable unless preview
  // const [isEditing, setIsEditing] = useState(false); 

  // ...

  return (
    <div className="pl-4 md:pl-[54px] group relative">
      {!!icon && !preview && (
        <div className={cn(
          "flex items-center gap-x-2 group/icon pt-6",
          !!initialData.coverImage && "-mt-8 pt-0"
        )}>
          <IconPicker onChange={onIconSelect}>
            <p className="text-5xl hover:opacity-75 transition">
              {icon}
            </p>
          </IconPicker>
          <Button
            onClick={onRemoveIcon}
            variant="outline"
            size="icon"
            className="rounded-full opacity-0 group-hover/icon:opacity-100 transition text-muted-foreground text-xs"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {!!icon && preview && (
        <p className={cn(
          "text-5xl pt-4",
          !!initialData.coverImage && "-mt-8 pt-0"
        )}>
          {icon}
        </p>
      )}

      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-x-1 py-1">
        {!icon && !preview && (
          <IconPicker asChild onChange={onIconSelect}>
            <Button
              className="text-muted-foreground text-xs"
              variant="outline"
              size="sm"
            >
              <Smile className="h-4 w-4 mr-2" /> Add icon
            </Button>
          </IconPicker>
        )}

        {!initialData.coverImage && !preview && (
          <Button
            onClick={coverImage.onOpen}
            className="text-muted-foreground text-xs"
            variant="outline"
            size="sm"
          >
            <ImageIcon className="h-4 w-4 mr-2" /> Add cover
          </Button>
        )}

        {!preview && (
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                className="text-muted-foreground text-xs"
                variant="outline"
                size="sm"
                onClick={onGenerateTitle}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate title
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="start">
              <div className="space-y-2">
                <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">AI Suggestion</h4>
                <div className="text-sm font-medium bg-muted/50 p-2 rounded-md border text-foreground">
                  {generatedTitle}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsPopoverOpen(false)}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={applyGeneratedTitle}
                    className="h-8 text-xs bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0"
                  >
                    <Check className="h-3 w-3 mr-1.5" />
                    Use this title
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {preview ? (
        <div className={cn(
          "pb-2 text-4xl font-bold break-words outline-none text-[#3F3F3F] dark:text-[#CFCFCF]",
          isPlaceholder && "text-[#9B9B9B] dark:text-[#5C5C5C]"
        )}>
          {displayTitle}
        </div>
      ) : (
        <div className="relative w-full">
          <TextareaAutosize
            ref={inputRef}
            onKeyDown={onKeyDown}
            value={isPlaceholder ? "" : rawTitle}
            placeholder={PLACEHOLDER_TITLE}
            onChange={(e) => onInput(e.target.value)}
            className="text-4xl bg-transparent font-bold break-words outline-none text-[#3F3F3F] dark:text-[#CFCFCF] resize-none w-full placeholder:text-[#9B9B9B] dark:placeholder:text-[#5C5C5C]"
          />
          {saveStatus !== "idle" && (
            <div className="absolute -bottom-6 left-0 flex items-center gap-x-2 text-xs text-muted-foreground animate-in fade-in duration-300">
              {saveStatus === "saving" ? (
                <Loader2 className="h-3 w-3 animate-spin text-orange-500" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
              )}
              <span>{saveStatus === "saving" ? "Saving progress..." : "Changes pending..."}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
