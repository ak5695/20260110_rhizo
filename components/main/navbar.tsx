"use client";

import { useParams } from "next/navigation";
import { getById } from "@/actions/documents";
import { Title } from "@/components/main/title";
import { Banner } from "@/components/main/banner";
import { Menu } from "@/components/main/menu";
import { Publish } from "@/components/main/publish";
import useSWR from "swr";

import { ChevronsLeft, ChevronsRight, MenuIcon, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { useSidebarStore, useSidebarCollapsed } from "@/store/use-sidebar-store";

interface NavbarProps {
  isCanvasOpen?: boolean;
  onToggleCanvas?: () => void;
  isOutlineOpen?: boolean;
  onToggleOutline?: () => void;
}

export const Navbar = ({ isCanvasOpen, onToggleCanvas, isOutlineOpen, onToggleOutline }: NavbarProps) => {
  const params = useParams();

  // Use Zustand store for sidebar state (no more window events!)
  const isCollapsed = useSidebarCollapsed();
  const { expand } = useSidebarStore();

  const { data: document, mutate } = useSWR(
    params.documentId ? ["document", params.documentId] : null,
    ([, id]) => getById(id as string),
    {
      revalidateOnFocus: true,
    }
  );

  // Listen for document changes to refresh the navbar title
  useEffect(() => {
    const handleDocumentsChanged = () => {
      mutate(); // Revalidate the SWR cache immediately
    };

    window.addEventListener("documents-changed", handleDocumentsChanged);
    return () => window.removeEventListener("documents-changed", handleDocumentsChanged);
  }, [mutate]);

  if (document === undefined) {
    return (
      <nav className="bg-background dark:bg-[#1F1F1F] px-3 py-2 w-full flex items-center justify-between">
        <Title.Skeleton />
        <div className="flex items-center gap-x-2">
          <Menu.Skeleton />
        </div>
      </nav>
    );
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
              <Button
                size="sm"
                variant="ghost"
                onClick={onToggleOutline}
                className={isOutlineOpen ? "bg-purple-500/10 text-purple-600 dark:text-purple-400" : ""}
              >
                <List className="h-4 w-4" />
              </Button>
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
