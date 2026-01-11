"use client";

import React, { ElementRef, useRef, useState, useCallback } from "react";
import { update, removeIcon } from "@/actions/documents";
import { IconPicker } from "@/components/icon-picker";
import { Button } from "@/components/ui/button";
import { ImageIcon, Smile, X } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { useCoverImage } from "@/hooks/use-cover-image";
import { writeQueue } from "@/lib/write-queue";

interface ToolbarProps {
  initialData: any; // Type adaptation
  preview?: boolean;
}

export const Toolbar = ({ initialData, preview }: ToolbarProps) => {
  const inputRef = useRef<ElementRef<"textarea">>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialData.title);

  const coverImage = useCoverImage();

  const enableInput = () => {
    if (preview) return;

    setIsEditing(true);
    setTimeout(() => {
      setValue(initialData.title);
      inputRef.current?.focus();
    }, 0);
  };

  const disableInput = () => setIsEditing(false);

  // Enterprise-grade onInput with write queue
  const onInput = useCallback((value: string) => {
    setValue(value);

    // Queue title update with debouncing (500ms)
    writeQueue.queueUpdate({
      documentId: initialData.id,
      fieldName: "title",
      updates: { title: value || "Untitled" },
      version: initialData.version,
      userId: initialData.userId,
    }).catch((error) => {
      console.error("[Toolbar] Failed to update title:", error);
    });
  }, [initialData.id, initialData.version, initialData.userId]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      disableInput();
    }
  };

  // Icon changes are immediate (no debounce)
  const onIconSelect = useCallback((icon: string) => {
    writeQueue.queueUpdate({
      documentId: initialData.id,
      fieldName: "icon",
      updates: { icon },
      version: initialData.version,
      userId: initialData.userId,
    }).catch((error) => {
      console.error("[Toolbar] Failed to update icon:", error);
    });
  }, [initialData.id, initialData.version, initialData.userId]);

  const onRemoveIcon = useCallback(() => {
    writeQueue.queueUpdate({
      documentId: initialData.id,
      fieldName: "icon",
      updates: { icon: null as any },
      version: initialData.version,
      userId: initialData.userId,
    }).catch((error) => {
      console.error("[Toolbar] Failed to remove icon:", error);
    });
  }, [initialData.id, initialData.version, initialData.userId]);

  return (
    <div className="pl-[54px] group relative">
      {!!initialData.icon && !preview && (
        <div className="flex items-center gap-x-2 group/icon pt-6">
          <IconPicker onChange={onIconSelect}>
            <p className="text-6xl hover:opacity-75 transition">
              {initialData.icon}
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

      {!!initialData.icon && preview && (
        <p className="text-6xl pt-6">{initialData.icon}</p>
      )}

      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-x-1 py-4">
        {!initialData.icon && !preview && (
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
        <TextareaAutosize
          ref={inputRef}
          onBlur={disableInput}
          onKeyDown={onKeyDown}
          value={value}
          onChange={(e) => onInput(e.target.value)}
          className="text-5xl bg-transparent font-bold break-words outline-none text-[#3F3F3F] dark:text-[#CFCFCF] resize-none"
        />
      ) : (
        <div
          onClick={enableInput}
          className="pb-[11.5px] text-5xl font-bold break-words outline-none text-[#3F3F3F] dark:text-[#CFCFCF]"
        >
          {initialData.title}
        </div>
      )}
    </div>
  );
};
