"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { getById, update } from "@/actions/documents";
import { Toolbar } from "@/components/toolbar";
import { Cover } from "@/components/cover";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { writeQueue } from "@/lib/write-queue";
import { OptimisticLockError } from "@/lib/errors";

export default function DocumentIdPage() {
  const { documentId } = useParams();
  const Editor = useMemo(
    () => dynamic(() => import("@/components/editor"), { ssr: false }),
    [],
  );

  const TldrawCanvas = useMemo(
    () => dynamic(() => import("@/components/tldraw-canvas"), { ssr: false }),
    [],
  );

  const [document, setDocument] = useState<any>(undefined);
  const documentVersionRef = useRef<number>(0);

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
        // Queue update with debouncing (1000ms for content)
        // We no longer pass the version from the client to avoid sync issues during rapid typing.
        // The server will handle optimistic locking using its latest known version.
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
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 文档编辑区 (文档 = 线性载体) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="pb-40">
          <Cover url={document.coverImage} />
          <div className="md:max-w-3xl lg:max-w-4xl mx-auto">
            <Toolbar initialData={document} />
            <Editor
              onChange={onChange}
              initialContent={document.content}
              userId={document.userId}
              documentId={documentId as string}
            />
          </div>
        </div>
      </div>

      {/* Canvas 画布区 (可视化 = 图形载体) */}
      <div className="relative w-[50%] hidden lg:block group/resizer transition-all duration-500 overflow-hidden">
        {/* 分界线 */}
        <div className="absolute -left-[0.5px] top-0 bottom-0 w-[1px] bg-border/40 z-50 shadow-[0_0_30px_rgba(0,0,0,0.15)] pointer-events-none" />

        <div className="h-full border-l border-white/5 bg-background relative z-10">
          <TldrawCanvas />
        </div>
      </div>
    </div>
  );
}
