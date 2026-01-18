"use client";

import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { getById } from "@/actions/documents";
import { Title } from "@/components/main/title";
import { Banner } from "@/components/main/banner";
import { Menu } from "@/components/main/menu";
import { ShareModal } from "@/components/modals/share-modal";
import useSWR from "swr";

import { ChevronsLeft, ChevronsRight, MenuIcon, List, HelpCircle, Presentation, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { useLayoutStore } from "@/store/use-layout-store";
import { useSidebarStore, useSidebarCollapsed } from "@/store/use-sidebar-store";
import { useMediaQuery } from "@/hooks/use-media-query";

interface NavbarProps {
  initialData?: any;
  isCanvasOpen?: boolean;
  onToggleCanvas?: () => void;
  isOutlineOpen?: boolean;
  onToggleOutline?: () => void;
  onToggleChat?: () => void;
}

export const Navbar = ({ initialData, isCanvasOpen, onToggleCanvas, isOutlineOpen, onToggleOutline, onToggleChat }: NavbarProps) => {
  const params = useParams();

  // Use Zustand store for sidebar state (no more window events!)
  const isCollapsed = useSidebarCollapsed();
  const { expand } = useSidebarStore();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const handleCanvasToggle = () => {
    if (isMobile) {
      const { isCanvasOpen, isCanvasFullscreen, openCanvas, closeCanvas, setCanvasFullscreen } = useLayoutStore.getState();

      if (!isCanvasOpen) {
        // State 1 (Doc) -> State 2 (Canvas Fullscreen)
        setCanvasFullscreen(true);
      } else if (isCanvasFullscreen) {
        // State 2 (Canvas Fullscreen) -> State 3 (Split)
        setCanvasFullscreen(false);
      } else {
        // State 3 (Split) -> State 1 (Doc)
        closeCanvas();
      }
    } else {
      onToggleCanvas?.();
    }
  };

  const { data: document, mutate } = useSWR(
    params.documentId ? ["document", params.documentId] : null,
    ([, id]) => getById(id as string),
    {
      revalidateOnFocus: false, // Prevent background refetching stealing focus
      fallbackData: initialData
    }
  );

  // Removed broad 'documents-changed' listener to prevent aggressive SWR revalidation
  // which can cause focus loss if Navbar/Title re-renders while typing.
  // The Title component now uses Zustand for real-time updates.
  /*
  useEffect(() => {
    const handleDocumentsChanged = () => {
      mutate();
    };

    window.addEventListener("documents-changed", handleDocumentsChanged);
    return () => window.removeEventListener("documents-changed", handleDocumentsChanged);
  }, [mutate]);
  */

  if (document === undefined) {
    return null;
  }

  if (document === null) return null;

  return (
    <>
      <nav className="bg-background dark:bg-[#1F1F1F] px-3 py-2 w-full flex items-center gap-x-4">
        {isCollapsed && (
          <MenuIcon
            role="button"
            onClick={expand}
            className="h-6 w-6 text-muted-foreground cursor-pointer hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded-sm"
          />
        )}
        <div className="flex items-center w-full min-w-0 gap-x-2">
          <div className="flex-1 min-w-0">
            <Title initialData={document} />
          </div>
          <div className="flex items-center gap-x-0.5 shrink-0">
            {isMobile && onToggleChat && (
              <div
                role="button"
                onClick={onToggleChat}
                className="h-8 w-8 flex items-center justify-center rounded-sm hover:bg-neutral-300 dark:hover:bg-neutral-600 text-muted-foreground cursor-pointer transition"
              >
                <Sparkles className="h-4 w-4 text-rose-600" />
              </div>
            )}
            {!document.isArchived && (
              <ShareModal documentId={document.id} initialPublished={document.isPublished}>
                <Button size="sm" variant="ghost" className={cn(document.isPublished && "text-sky-500 font-medium")}>
                  Share
                  {document.isPublished && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-sky-500" />}
                </Button>
              </ShareModal>
            )}
            <Menu document={document} />
            {onToggleOutline && (
              <>
                <div
                  role="button"
                  onClick={() => {
                    import("@/store/use-layout-store").then(({ useLayoutStore }) => {
                      useLayoutStore.getState().toggleQaList();
                    });
                  }}
                  className="h-8 w-8 flex items-center justify-center rounded-sm hover:bg-neutral-300 dark:hover:bg-neutral-600 text-muted-foreground cursor-pointer transition"
                >
                  <HelpCircle className="h-4 w-4" />
                </div>
                <div
                  role="button"
                  onClick={onToggleOutline}
                  className={cn(
                    "h-8 w-8 flex items-center justify-center rounded-sm hover:bg-neutral-300 dark:hover:bg-neutral-600 text-muted-foreground cursor-pointer transition",
                    isOutlineOpen && "bg-neutral-300 dark:bg-neutral-600 text-primary"
                  )}
                >
                  <List className="h-4 w-4" />
                </div>
              </>
            )}
            {onToggleCanvas && (
              <div
                role="button"
                onClick={handleCanvasToggle}
                className="h-8 w-8 flex items-center justify-center rounded-sm hover:bg-neutral-300 dark:hover:bg-neutral-600 text-muted-foreground cursor-pointer transition"
              >
                {isMobile ? (
                  <Presentation className="h-4 w-4" />
                ) : isCanvasOpen ? (
                  <ChevronsRight className="h-4 w-4" />
                ) : (
                  <ChevronsLeft className="h-4 w-4" />
                )}
              </div>
            )}
          </div>
        </div>
      </nav>
      {document.isArchived && <Banner documentId={document.id} />}
    </>
  );
};
