"use client";

import { Skeleton } from "@/components/ui/skeleton";

import { getById } from "@/actions/documents";
import { Cover } from "@/components/cover";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { writeQueue } from "@/lib/write-queue";
import { useDocumentStore } from "@/store/use-document-store";
import { DocumentEditorLayout } from "@/components/document/document-editor-layout";

export default function DocumentIdPage() {
  const { documentId } = useParams();
  const [document, setDocument] = useState<any>(null); // Start with null, not optimism
  const documentVersionRef = useRef<number>(0);
  const lastDocumentIdRef = useRef<string | null>(null);

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
      // 【Step 1】立即检查 Zustand Store（同步，零延迟）
      const storeDoc = useDocumentStore.getState().documents.get(documentId);
      if (storeDoc && isMounted) {
        console.log("[DocumentPage] Instant from Zustand Store");
        setDocument(storeDoc);
        documentVersionRef.current = storeDoc.version || 0;
      }

      // 【Step 2】检查 IndexedDB 缓存（异步，<10ms）
      let cacheLoaded = false;
      try {
        const { documentCache } = await import("@/lib/cache/document-cache");
        const cached = await documentCache.get(documentId, async () => null);
        if (cached && isMounted) {
          // Only update if we don't have data yet or cache is newer
          if (!document || cached.version > documentVersionRef.current) {
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
        if (!isMounted) return;

        try {
          // Use simpler check before heavy lifting
          if (!documentId) return;

          const serverDoc = await getById(documentId);

          if (serverDoc && isMounted) {
            // Only update if server has newer version
            if (serverDoc.version >= documentVersionRef.current) {
              setDocument(serverDoc);
              documentVersionRef.current = serverDoc.version;

              // Update cache for next time
              const { documentCache } = await import("@/lib/cache/document-cache");
              documentCache.set(documentId, serverDoc);

              console.log("[DocumentPage] Synced from server, version:", serverDoc.version);
            }
          } else if (!document && isMounted) {
            // Document not found and we have no cached version
            setDocument(null);
          }
        } catch (err) {
          console.error("[DocumentPage] Server fetch error:", err);
          // Keep showing cached data if available
          if (!document && isMounted) {
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
    <DocumentEditorLayout
      document={document}
      documentId={documentId as string}
      onChange={onChange}
    />
  );
}
