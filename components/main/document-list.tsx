"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Item } from "@/components/main/item";
import { cn } from "@/lib/utils";
import { FileIcon } from "lucide-react";
import useSWR from "swr";
import { getSidebar } from "@/actions/documents";

interface DocumentListProps {
  parentDocumentId?: string;
  level?: number;
  data?: any[];
}

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

  const { data: documents } = useSWR(
    ["documents", parentDocumentId],
    ([, id]) => getSidebar(id)
  );

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
          <Item
            id={document.id}
            label={document.title}
            onClick={() => onRedirect(document.id)}
            icon={FileIcon}
            documentIcon={document.icon || undefined}
            active={params.documentId === document.id}
            level={level}
            onExpand={() => onExpand(document.id)}
            expanded={expanded[document.id]}
          />
          {expanded[document.id] && (
            <DocumentList parentDocumentId={document.id} level={level + 1} />
          )}
        </div>
      ))}
    </>
  );
};
