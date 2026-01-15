"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Item } from "@/components/main/item";
import { cn } from "@/lib/utils";
import { FileIcon } from "lucide-react";
import useSWR from "swr";
import { getSidebar } from "@/actions/documents";
import { useDocumentStore } from "@/store/use-document-store";
import { sidebarCache } from "@/lib/cache/sidebar-cache";

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

  // 【即时加载】从内存缓存同步读取（零延迟）
  const [cachedDocs, setCachedDocs] = useState<any[] | null>(() => {
    // 同步读取内存缓存作为初始值
    return sidebarCache.getSync(parentDocumentId || "root");
  });

  // 【后台同步】SWR 从服务器获取最新数据
  const { data: documents, mutate } = useSWR(
    ["documents", parentDocumentId],
    ([, id]) => getSidebar(id),
    {
      revalidateOnFocus: false, // 禁用焦点重新验证，避免切换窗口时触发
      revalidateIfStale: false, // 禁用过期自动验证，完全依赖手动事件触发
      revalidateOnReconnect: false, // 网络重连时不自动刷新
      refreshInterval: 0, // 禁用自动轮询，Sidebar数据相对静态，不需要Polling
      // 使用缓存作为 fallback
      fallbackData: cachedDocs || undefined,
      onSuccess: (data) => {
        if (data && Array.isArray(data)) {
          // 保存到缓存
          sidebarCache.set(parentDocumentId || "root", data);

          // ⚡ Hyper-Speed Seeding: Pre-load all fetched docs into local cache & store
          const docStore = useDocumentStore.getState();
          import("@/lib/cache/document-cache").then(({ documentCache }) => {
            data.forEach((doc) => {
              // 1. Sync metadata to Zustand for instant title/icon
              docStore.setDocument({
                id: doc.id,
                title: doc.title,
                icon: doc.icon,
                version: doc.version,
                userId: doc.userId,
                parentDocumentId: doc.parentDocumentId,
                content: doc.content, // ⚡ Critical: Content for instant render
              });

              // 2. Sync full document to persistent IndexedDB cache
              documentCache.set(doc.id, doc);
            });
          });
        }
      }
    }
  );

  // 【异步缓存加载】如果同步缓存未命中，异步加载 IndexedDB
  useEffect(() => {
    if (!cachedDocs) {
      sidebarCache.get(parentDocumentId || "root").then((cached) => {
        if (cached && !documents) {
          setCachedDocs(cached);
          console.log("[DocumentList] Loaded from IndexedDB cache");
        }
      });
    }
  }, [parentDocumentId, cachedDocs, documents]);

  const onExpand = (documentId: string) => {
    setExpanded((prevExpand) => ({
      ...prevExpand,
      [documentId]: !prevExpand[documentId],
    }));
  };

  // Listen for document change events (create/delete) to trigger revalidation
  useEffect(() => {
    const handleDocumentsChanged = () => {
      // Invalidate cache and refetch
      sidebarCache.invalidate(parentDocumentId || "root");
      mutate();
    };

    window.addEventListener("documents-changed", handleDocumentsChanged);
    return () => window.removeEventListener("documents-changed", handleDocumentsChanged);
  }, [mutate, parentDocumentId]);

  const onRedirect = (documentId: string) => {
    router.push(`/documents/${documentId}`);
  };

  // 使用服务器数据或缓存数据
  const displayDocs = documents || cachedDocs;

  if (displayDocs === undefined || displayDocs === null) {
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
      {displayDocs.map((document) => (
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

