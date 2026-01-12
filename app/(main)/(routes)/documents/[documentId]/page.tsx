"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
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
    () => dynamic(() => import("@/components/editor"), {
      ssr: false,
      loading: () => (
        <div className="space-y-4 pt-4">
          <Skeleton className="h-4 w-[80%]" />
          <Skeleton className="h-4 w-[40%]" />
          <Skeleton className="h-4 w-[60%]" />
        </div>
      )
    }),
    [],
  );

  const ExcalidrawCanvas = useMemo(
    () => dynamic(() => import("@/components/excalidraw-canvas"), {
      ssr: false,
      loading: () => (
        <div className="h-full w-full flex items-center justify-center bg-muted/20">
          <div className="flex flex-col items-center gap-y-2">
            <Loader2 className="h-6 w-6 text-rose-500 animate-spin" />
            <p className="text-xs text-muted-foreground font-medium">Canvas Initializing...</p>
          </div>
        </div>
      )
    }),
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

  // ⚡ Enterprise Load Strategy (Notion-like)
  // 1. 立即尝试加载（乐观）
  // 2. 快速重试（指数退避，最大3次）
  // 3. 处理乐观创建的Race Condition
  useEffect(() => {
    if (typeof documentId !== "string") return;

    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const load = async () => {
      try {
        const doc = await getById(documentId);

        if (doc) {
          if (isMounted) {
            setDocument(doc);
            documentVersionRef.current = doc.version;
          }
        } else if (retryCount < maxRetries) {
          // ⚡ 优化：使用指数退避，但首次重试更快（100ms）
          // Notion的策略：首次快速重试，后续逐渐延长
          retryCount++;
          const delay = retryCount === 1 ? 100 : 200 * Math.pow(2, retryCount - 2);
          console.log(`[DocumentPage] Optimistic load retry ${retryCount}/${maxRetries} after ${delay}ms`);
          setTimeout(load, delay);
        } else {
          if (isMounted) setDocument(null);
        }
      } catch (err) {
        if (retryCount < maxRetries) {
          retryCount++;
          const delay = 200 * Math.pow(2, retryCount - 1);
          setTimeout(load, delay);
        } else if (isMounted) {
          setDocument(null);
        }
      }
    };

    load();
    return () => { isMounted = false; };
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

  // Fast Shell: If document is still loading, show the basic structure immediately
  // to prevent the "Blank Screen" flash that users hate.
  if (document === undefined) {
    return (
      <div className="relative h-full overflow-hidden bg-background dark:bg-[#1F1F1F]">
        <div className="absolute left-0 top-0 bottom-0 right-0 flex flex-col overflow-hidden">
          <div className="h-12 border-b bg-background/50 flex items-center px-4">
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="pb-40">
              <Cover.Skeleton />
              <div className="md:max-w-3xl lg:max-w-4xl mx-auto mt-10 space-y-4 px-8">
                <Skeleton className="h-10 w-[60%]" />
                <Skeleton className="h-4 w-[80%]" />
                <Skeleton className="h-4 w-[40%]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (document === null) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <p className="text-muted-foreground">Document not found</p>
      </div>
    );
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
