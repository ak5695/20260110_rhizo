"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentStore, useDocumentTitle, useDocumentIcon } from "@/store/use-document-store";

interface TitleProps {
  initialData: any;
}

export const Title = ({ initialData }: TitleProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Use Zustand store for real-time sync
  const { setDocument, updateTitle } = useDocumentStore();
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
  // Check if title is placeholder
  const rawTitle = storeTitle ?? initialData.title;
  const isPlaceholder = !rawTitle || rawTitle === "Untitled";
  const displayTitle = isPlaceholder ? "Untitled" : rawTitle;
  const icon = storeIcon !== undefined ? storeIcon : initialData.icon;

  const enableInput = () => {
    setIsEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      // If placeholder, select all for easy replacement
      if (isPlaceholder) {
        inputRef.current?.select();
      } else {
        inputRef.current?.setSelectionRange(0, inputRef.current.value.length);
      }
    }, 0);
  };

  const disableInput = () => {
    setIsEditing(false);
  };

  // Real-time title update via Zustand store
  const onChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = event.target.value;
    updateTitle(initialData.id, newTitle);
  }, [initialData.id, updateTitle]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      disableInput();
    }
  };

  return (
    <div className="flex items-center gap-x-1">
      {!!icon && <p>{icon}</p>}
      {isEditing ? (
        <Input
          ref={inputRef}
          onClick={enableInput}
          onBlur={disableInput}
          onChange={onChange}
          onKeyDown={onKeyDown}
          value={isPlaceholder ? "" : rawTitle}
          placeholder="Untitled"
          className="h-7 px-2 focus-visible:ring-transparent placeholder:text-muted-foreground/50"
        />
      ) : (
        <Button
          onClick={enableInput}
          variant="ghost"
          size="sm"
          className="font-normal h-auto p-1"
        >
          <span className={isPlaceholder ? "truncate text-muted-foreground" : "truncate"}>
            {displayTitle}
          </span>
        </Button>
      )}
    </div>
  );
};

Title.Skeleton = function TitleSkeleton() {
  return <Skeleton className="h-9 w-20 rounded-md" />;
};
