"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { getById, update } from "@/actions/documents";
import { Toolbar } from "@/components/toolbar";
import { Cover } from "@/components/cover";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { writeQueue } from "@/lib/write-queue";
import { OptimisticLockError } from "@/lib/safe-update";

export default function DocumentIdPage() {
  const { documentId } = useParams();
  const Editor = useMemo(
    () => dynamic(() => import("@/components/editor"), { ssr: false }),
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

  // Enterprise-grade onChange with write queue and optimistic locking
  const onChange = useCallback(async (content: string) => {
    if (typeof documentId === "string" && document?.userId) {
      try {
        // Queue update with debouncing (1000ms for content)
        await writeQueue.queueUpdate({
          documentId,
          fieldName: "content",
          updates: { content },
          version: documentVersionRef.current,
          userId: document.userId,
        });

        // Update version after successful write
        documentVersionRef.current += 1;
      } catch (error) {
        console.error("[DocumentPage] Failed to update content:", error);
        // Write queue will handle retries automatically
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
    <div className="pb-40">
      <Cover url={document.coverImage} />
      <div className="md:max-w-3xl lg:max-w-4xl mx-auto">
        <Toolbar initialData={document} />
        <Editor onChange={onChange} initialContent={document.content} />
      </div>
    </div>
  );
}
