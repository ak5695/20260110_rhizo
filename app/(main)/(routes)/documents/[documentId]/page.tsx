"use client";

import { Skeleton } from "@/components/ui/skeleton";

import { getById } from "@/actions/documents";
import { Cover } from "@/components/cover";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { writeQueue } from "@/lib/write-queue";
import { useDocumentStore } from "@/store/use-document-store";
import { useCanvasOpen, useCanvasFullscreen } from "@/store/use-layout-store";
import { EditorSkeleton, CanvasSkeleton, SplitSkeleton } from "@/components/loading-skeletons";
import { DocumentEditorLayout } from "@/components/document/document-editor-layout";

export default function DocumentIdPage() {
  const { documentId } = useParams();
  const [document, setDocument] = useState<any>(undefined); // Start with undefined (Loading Skeleton)
  const documentVersionRef = useRef<number>(0);
  const lastDocumentIdRef = useRef<string | null>(null);
  const activeIdRef = useRef<string | string[] | null>(null);

  // Layout State for Context-Aware Skeletons
  const isCanvasOpen = useCanvasOpen();
  const isCanvasFullscreen = useCanvasFullscreen();

  // Sync active ID ref immediately
  // Sync active ID ref immediately
  if (activeIdRef.current !== documentId) {
    activeIdRef.current = documentId ?? null;
  }


  // ⚡ Instant Document Loading - Cache-First Strategy
  // Goal: NEVER show loading skeleton when switching between cached documents
  useEffect(() => {
    if (typeof documentId !== "string") return;

    // If same document, skip
    if (lastDocumentIdRef.current === documentId && document) return;
    lastDocumentIdRef.current = documentId;

    let isMounted = true;
    let syncTimer: NodeJS.Timeout;

    const loadDocument = async () => {
      // guard: verify we are still on the same document
      if (activeIdRef.current !== documentId) return;

      // 【Step 1】立即检查 Zustand Store（同步，零延迟）
      // 使用 useLayoutEffect 确保在绘制前获取数据
      const storeDoc = useDocumentStore.getState().documents.get(documentId);
      if (storeDoc && activeIdRef.current === documentId) {
        if (storeDoc.content) {
          // Sync immediately if we have it
          setDocument(storeDoc);
          documentVersionRef.current = storeDoc.version || 0;
          return; // Skip other steps if we have authoritative data
        }
      }

      // 【Step 2】检查 IndexedDB 缓存（异步，<10ms）
      let cacheLoaded = false;
      try {
        const { documentCache } = await import("@/lib/cache/document-cache");
        const cached = await documentCache.get(documentId, async () => null);

        if (activeIdRef.current !== documentId || !isMounted) return;

        if (cached) {
          // Only update if we don't have data yet or cache is newer
          // Also useful if storeDoc was partial (no content) but cache is full
          if (!document || !document.content || cached.version > documentVersionRef.current) {
            console.log("[DocumentPage] Instant from IndexedDB Cache");
            setDocument(cached);
            documentVersionRef.current = cached.version;
            cacheLoaded = true;
          }
        }
      } catch (e) {
        console.warn("[DocumentPage] Cache read error:", e);
      }

      // 【Step 3】后台从服务器同步（延迟 500ms 以避免频繁请求）
      // 如果用户在 500ms 内切换文档，请求将被取消
      syncTimer = setTimeout(async () => {
        if (!isMounted || activeIdRef.current !== documentId) return;

        try {
          // Use simpler check before heavy lifting
          if (!documentId) return;

          const serverDoc = await getById(documentId);

          if (!isMounted || activeIdRef.current !== documentId) return;

          if (serverDoc) {
            // Only update if server has newer version, OR if we are missing content (e.g. loaded from partial list)
            // CRITICAL: We use '>' instead of '>=' to avoid re-rendering if version is identical.
            // This prevents "early focus loss" caused by redundant hydration of same data.
            if (serverDoc.version > documentVersionRef.current || !document?.content) {

              // Double check content deep equality if version is strictly greater but we want to be extra safe?
              // No, version should be the source of truth.

              setDocument(serverDoc);
              documentVersionRef.current = serverDoc.version;

              // Update cache for next time
              const { documentCache } = await import("@/lib/cache/document-cache");
              documentCache.set(documentId, serverDoc);

              console.log("[DocumentPage] Synced from server, version:", serverDoc.version);
            } else {
              console.log(`[DocumentPage] Server version ${serverDoc.version} matches/older than current ${documentVersionRef.current}. Skipping update.`);
            }
          } else if (document === undefined && isMounted) {
            // Document not found (and currently showing skeleton) -> switch to Not Found
            // Only if we truly have nothing
            setDocument(null);
          }
        } catch (err) {
          console.error("[DocumentPage] Server fetch error:", err);
          // Keep showing cached data if available
          if (document === undefined && isMounted) {
            setDocument(null);
          }
        }
      }, 500);
    };

    loadDocument();
    return () => {
      isMounted = false;
      clearTimeout(syncTimer);
    };
  }, [documentId]); // Only depend on documentId, not document

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
  // Fast Shell: If document is still loading, show the basic structure immediately
  // to prevent the "Blank Screen" flash that users hate.
  if (document === undefined) {
    if (isCanvasFullscreen) {
      return <CanvasSkeleton />;
    }
    if (isCanvasOpen) {
      return <SplitSkeleton />;
    }
    return <EditorSkeleton />;
  }

  if (document === null) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <p className="text-muted-foreground">Document not found</p>
      </div>
    );
  }

  return (
    <DocumentEditorLayout
      document={document}
      documentId={documentId as string}
      onChange={onChange}
    />
  );
}
