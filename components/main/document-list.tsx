"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Item } from "@/components/main/item";
import { cn } from "@/lib/utils";
import { FileIcon } from "lucide-react";
import useSWR from "swr";
import { getSidebar } from "@/actions/documents";
import { useDocumentStore } from "@/store/use-document-store";

interface DocumentListProps {
  parentDocumentId?: string;
  level?: number;
  data?: any[];
}

/**
 * DocumentItem - Renders a single document with real-time title from Zustand store
 */
const DocumentItem = ({
  document,
  level,
  active,
  expanded,
  onExpand,
  onRedirect
}: {
  document: any;
  level: number;
  active: boolean;
  expanded: boolean;
  onExpand: () => void;
  onRedirect: () => void;
}) => {
  // Subscribe to real-time title/icon updates from store
  const storeDoc = useDocumentStore((state) => state.documents.get(document.id));

  // Use store values if available, otherwise use document data
  const title = storeDoc?.title ?? document.title;
  const icon = storeDoc?.icon !== undefined ? storeDoc.icon : document.icon;

  return (
    <Item
      id={document.id}
      label={title}
      onClick={onRedirect}
      icon={FileIcon}
      documentIcon={icon || undefined}
      active={active}
      level={level}
      onExpand={onExpand}
      expanded={expanded}
    />
  );
};

export const DocumentList = ({
  parentDocumentId,
  level = 0,
}: DocumentListProps) => {
  const params = useParams();
  const router = useRouter();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const onExpand = (documentId: string) => {
    setExpanded((prevExpand) => ({
      ...prevExpand,
      [documentId]: !prevExpand[documentId],
    }));
  };

  const { data: documents, mutate } = useSWR(
    ["documents", parentDocumentId],
    ([, id]) => getSidebar(id),
    {
      // Revalidate on focus and every 30 seconds for background sync
      revalidateOnFocus: true,
      refreshInterval: 30000,
    }
  );

  // Listen for document change events (create/delete) to trigger revalidation
  useEffect(() => {
    const handleDocumentsChanged = () => {
      mutate(); // Revalidate the SWR cache immediately
    };

    window.addEventListener("documents-changed", handleDocumentsChanged);
    return () => window.removeEventListener("documents-changed", handleDocumentsChanged);
  }, [mutate]);

  const onRedirect = (documentId: string) => {
    router.push(`/documents/${documentId}`);
  };

  if (documents === undefined) {
    return (
      <>
        <Item.Skeleton level={level} />
        {level === 0 && (
          <>
            <Item.Skeleton level={level} />
            <Item.Skeleton level={level} />
          </>
        )}
      </>
    );
  }

  return (
    <>
      <p
        className={cn(
          "hidden text-sm font-medium text-muted-foreground/80",
          expanded && "last:block",
          level === 0 && "hidden",
        )}
        style={{ paddingLeft: level ? `${level * 12 + 25}px` : undefined }}
      >
        No page inside
      </p>
      {documents.map((document) => (
        <div key={document.id}>
          <DocumentItem
            document={document}
            level={level}
            active={params.documentId === document.id}
            expanded={expanded[document.id]}
            onExpand={() => onExpand(document.id)}
            onRedirect={() => onRedirect(document.id)}
          />
          {expanded[document.id] && (
            <DocumentList parentDocumentId={document.id} level={level + 1} />
          )}
        </div>
      ))}
    </>
  );
};
