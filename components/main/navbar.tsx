"use client";

import { useParams } from "next/navigation";
import { getById } from "@/actions/documents";
import { Title } from "@/components/main/title";
import { Banner } from "@/components/main/banner";
import { Menu } from "@/components/main/menu";
import { Publish } from "@/components/main/publish";
import useSWR from "swr";

import { ChevronsLeft, ChevronsRight, MenuIcon, List, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { useSidebarStore, useSidebarCollapsed } from "@/store/use-sidebar-store";

interface NavbarProps {
  initialData?: any;
  isCanvasOpen?: boolean;
  onToggleCanvas?: () => void;
  isOutlineOpen?: boolean;
  onToggleOutline?: () => void;
}

export const Navbar = ({ initialData, isCanvasOpen, onToggleCanvas, isOutlineOpen, onToggleOutline }: NavbarProps) => {
  const params = useParams();

  // Use Zustand store for sidebar state (no more window events!)
  const isCollapsed = useSidebarCollapsed();
  const { expand } = useSidebarStore();

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
        <div className="flex items-center justify-between w-full">
          <Title initialData={document} />
          <div className="flex items-center gap-x-0">
            <Publish initialData={document} />
            <Menu documentId={document.id} />
            {onToggleOutline && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    import("@/store/use-layout-store").then(({ useLayoutStore }) => {
                      useLayoutStore.getState().toggleQaList();
                    });
                  }}
                  className="text-muted-foreground"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onToggleOutline}
                  className={isOutlineOpen ? "bg-purple-500/10 text-purple-600 dark:text-purple-400" : ""}
                >
                  <List className="h-4 w-4" />
                </Button>
              </>
            )}
            {onToggleCanvas && (
              <Button size="sm" variant="ghost" onClick={onToggleCanvas}>
                {isCanvasOpen ? (
                  <ChevronsRight className="h-4 w-4" />
                ) : (
                  <ChevronsLeft className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </nav>
      {document.isArchived && <Banner documentId={document.id} />}
    </>
  );
};
