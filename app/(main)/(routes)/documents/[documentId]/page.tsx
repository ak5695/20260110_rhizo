"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getById } from "@/actions/documents";
import { Toolbar } from "@/components/toolbar";
import { Cover } from "@/components/cover";
import { Navbar } from "@/components/main/navbar";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { writeQueue } from "@/lib/write-queue";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { DocumentOutline } from "@/components/document-outline";
import {
  useLayoutStore,
  useCanvasOpen,
  useCanvasFullscreen,
  useOutlineOpen
} from "@/store/use-layout-store";

export default function DocumentIdPage() {
  const { documentId } = useParams();
  const Editor = useMemo(
    () => dynamic(() => import("@/components/editor"), { ssr: false }),
    [],
  );

  const ExcalidrawCanvas = useMemo(
    () => dynamic(() => import("@/components/excalidraw-canvas"), { ssr: false }),
    [],
  );

  const [document, setDocument] = useState<any>(undefined);
  const documentVersionRef = useRef<number>(0);
  const [editorDocument, setEditorDocument] = useState<any>(null);

  // Use Zustand store for layout state (no more useState + props drilling!)
  const isCanvasOpen = useCanvasOpen();
  const isCanvasFullscreen = useCanvasFullscreen();
  const isOutlineOpen = useOutlineOpen();
  const { toggleCanvas, toggleFullscreen, toggleOutline, openCanvas } = useLayoutStore();

  useEffect(() => {
    if (typeof documentId === "string") {
      getById(documentId)
        .then((doc) => {
          setDocument(doc);
          documentVersionRef.current = doc.version;
        })
        .catch(() => setDocument(null));
    }
  }, [documentId]);

  // Listen for document conflicts
  useEffect(() => {
    const handleConflict = (event: any) => {
      if (event.detail.documentId === documentId) {
        alert("This document has been updated by another user. Please refresh to see the latest changes.");
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("document-conflict", handleConflict);
      return () => window.removeEventListener("document-conflict", handleConflict);
    }
  }, [documentId]);

  // Enterprise-grade onChange with write queue
  const onChange = useCallback(async (content: string) => {
    if (typeof documentId === "string" && document?.userId) {
      try {
        await writeQueue.queueUpdate({
          documentId,
          fieldName: "content",
          updates: { content },
          userId: document.userId,
        });
      } catch (error) {
        console.error("[DocumentPage] Failed to update content:", error);
      }
    }
  }, [documentId, document?.userId]);

  if (document === undefined) {
    return (
      <div>
        <Cover.Skeleton />
        <div className="md:max-w-3xl lg:max-w-4xl mx-auto mt-10">
          <div className="space-y-4 pl-8 pt-4">
            <Skeleton className="h-14 w-[50%]" />
            <Skeleton className="h-4 w-[80%]" />
            <Skeleton className="h-4 w-[40%]" />
            <Skeleton className="h-4 w-[60%]" />
          </div>
        </div>
      </div>
    );
  }

  if (document === null) {
    return <div>Not found</div>;
  }

  return (
    <div className="relative h-full overflow-hidden bg-background dark:bg-[#1F1F1F]">
      {/* 文档编辑区 (文档 = 线性载体) - 左侧 */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 flex flex-col overflow-hidden transition-all duration-500",
        isCanvasFullscreen ? "w-0 opacity-0" : (isCanvasOpen ? "right-[50%]" : "right-0")
      )}>
        {/* Navbar 固定在编辑器顶部 */}
        <div className="sticky top-0 z-50 bg-background">
          <Navbar
            isCanvasOpen={isCanvasOpen}
            onToggleCanvas={toggleCanvas}
            isOutlineOpen={isOutlineOpen}
            onToggleOutline={toggleOutline}
          />
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          <div className="pb-40">
            <Cover url={document.coverImage} />
            <div className="md:max-w-3xl lg:max-w-4xl mx-auto">
              <Toolbar initialData={document} />
              <Editor
                onChange={onChange}
                initialContent={document.content}
                userId={document.userId}
                documentId={documentId as string}
                onDocumentChange={setEditorDocument}
              />
            </div>
          </div>

          {/* Document Outline Sidebar - 固定在编辑区右侧 */}
          {isOutlineOpen && !isCanvasFullscreen && (
            <div className="fixed top-20 bottom-4 w-64 bg-background/95 dark:bg-[#1F1F1F]/95 backdrop-blur-sm border border-border/40 rounded-xl shadow-2xl overflow-hidden z-40 hidden xl:block transition-all duration-300"
              style={{
                right: isCanvasOpen ? "calc(50% + 1rem)" : "1rem"
              }}
            >
              <DocumentOutline editorDocument={editorDocument} className="h-full overflow-y-auto custom-scrollbar" />
            </div>
          )}
        </div>
      </div>

      {/* Canvas 画布区 (可视化 = 图形载体) - 右侧固定 */}
      {isCanvasOpen && (
        <div className={cn(
          "absolute right-0 top-0 bottom-0 hidden lg:flex group/resizer transition-all duration-500 h-full flex-col",
          isCanvasFullscreen ? "left-0" : "left-[50%]"
        )}>
          {/* 分界线 */}
          <div className="absolute -left-[0.5px] top-0 bottom-0 w-[1px] bg-border/40 z-50 shadow-[0_0_30px_rgba(0,0,0,0.15)] pointer-events-none" />

          <div className="flex-1 relative border-l border-white/5 bg-white dark:bg-gray-900 overflow-hidden">
            <ExcalidrawCanvas
              documentId={documentId as string}
              isFullscreen={isCanvasFullscreen}
              onToggleFullscreen={toggleFullscreen}
            />
          </div>
        </div>
      )}

      {/* Selection Toolbar - appears when text is selected */}
      <SelectionToolbar
        documentId={documentId as string}
        onEnsureCanvas={openCanvas}
      />
    </div >
  );
}
