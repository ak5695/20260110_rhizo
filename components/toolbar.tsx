"use client";

import React, { ElementRef, useRef, useState, useCallback, useEffect } from "react";
import { IconPicker } from "@/components/icon-picker";
import { Button } from "@/components/ui/button";
import { ImageIcon, Smile, X, Loader2 } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { useCoverImage } from "@/hooks/use-cover-image";
import { useDocumentStore, useDocumentTitle, useDocumentIcon } from "@/store/use-document-store";
import { cn } from "@/lib/utils";

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
    }
  };

  // Icon changes via Zustand store
  const onIconSelect = useCallback((newIcon: string) => {
    updateIcon(initialData.id, newIcon);
  }, [initialData.id, updateIcon]);

  const onRemoveIcon = useCallback(() => {
    updateIcon(initialData.id, null);
  }, [initialData.id, updateIcon]);

  return (
    <div className="pl-[54px] group relative">
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
      </div>
      {isEditing && !preview ? (
        <div className="relative w-full">
          <TextareaAutosize
            ref={inputRef}
            onBlur={disableInput}
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
      ) : (
        <div className="relative group/title">
          <div
            onClick={enableInput}
            className={cn(
              "pb-2 text-4xl font-bold break-words outline-none cursor-text",
              isPlaceholder
                ? "text-[#9B9B9B] dark:text-[#5C5C5C]"
                : "text-[#3F3F3F] dark:text-[#CFCFCF]"
            )}
          >
            {displayTitle}
          </div>
          {saveStatus !== "idle" && !isEditing && (
            <div className="absolute -bottom-4 left-0 flex items-center gap-x-2 text-[10px] text-muted-foreground opacity-70">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              <span>Synchronizing...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
