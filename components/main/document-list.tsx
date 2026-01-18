"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import { Item } from "@/components/main/item";
import { cn } from "@/lib/utils";
import { FileIcon } from "lucide-react";
import useSWR from "swr";
import { getSidebar, update } from "@/actions/documents";
import { useDocumentStore } from "@/store/use-document-store";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { sidebarCache } from "@/lib/cache/sidebar-cache";

interface DocumentListProps {
  parentDocumentId?: string;
  level?: number;
}

// --- Utils for Projection ---

// Flatten the tree for SortableContext
const flattenTree = (
  documents: any[],
  expanded: Record<string, boolean>,
  parentDocumentId: string | null = null,
  depth = 0
): any[] => {
  const result: any[] = [];
  const children = documents
    .filter((doc) => doc.parentDocumentId === parentDocumentId)
    .sort((a, b) => a.position - b.position);

  for (const child of children) {
    result.push({ ...child, depth });
    if (expanded[child.id]) {
      result.push(...flattenTree(documents, expanded, child.id, depth + 1));
    }
  }
  return result;
};


// --- Components ---

const SortableDocumentItem = ({
  document,
  level,
  onExpand,
  expanded,
  active,
}: {
  document: any;
  level: number;
  onExpand: () => void;
  expanded: boolean;
  active: boolean;
}) => {
  const router = useRouter();
  const storeDoc = useDocumentStore((state) => state.documents.get(document.id));
  const title = storeDoc?.title ?? document.title;
  const icon = storeDoc?.icon !== undefined ? storeDoc.icon : document.icon;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: document.id, data: { ...document, level } });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1, // Dim original item
  };

  const onRedirect = () => {
    router.push(`/documents/${document.id}`);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative"
    >
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
    </div>
  );
};

export const DocumentList = ({
  parentDocumentId,
}: DocumentListProps) => {
  const params = useParams();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  // 1. Fetch Data
  // Cache-First Strategy: Initialize with local cache synchronously!
  const [documents, setDocuments] = useState<any[] | null>(() => {
    if (typeof window !== "undefined") {
      const cached = sidebarCache.getSync("root");
      if (cached) console.log("[DocumentList] Sync Hydration:", cached.length);
      return cached;
    }
    return null;
  });

  const { data: serverDocuments, mutate } = useSWR(
    "documents-all",
    () => getSidebar(),
    {
      refreshInterval: 0,
      onSuccess: (data) => {
        setDocuments(data);
        sidebarCache.set("root", data);
      }
    }
  );

  // 2. Projections
  const visibleItems = useMemo(() => {
    if (!documents) return [];
    return flattenTree(documents, expanded, parentDocumentId || null);
  }, [documents, expanded, parentDocumentId]);

  const visibleIds = useMemo(() => visibleItems.map((item) => item.id), [visibleItems]);


  // 3. Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Prevent accidental drags
      },
    })
  );

  // 4. Handlers
  const onExpand = (documentId: string) => {
    setExpanded((prev) => ({
      ...prev,
      [documentId]: !prev[documentId],
    }));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;
    if (active.id === over.id) return;

    const activeDoc = documents?.find((d) => d.id === active.id);
    const overItem = visibleItems.find(i => i.id === over.id);

    if (!activeDoc || !overItem) return;

    // Determine Drop Logic based on relative position in the FLATTENED list
    // dnd-kit sortable is 1D list.
    // If dropping ON an item, we typically reorder adjacent to it.
    // Nesting logic in dnd-kit lists often involves indentation offset (like SortableTree),
    // but for this V2 Quick Win we can map simple "Place Below" logic for now.

    // Simple Vertical Sort Logic:
    // Move active to the position of over.
    // Inherit the same parent as the 'over' item (sibling reorder)

    // Exception: If dropping ON a folder that is expanded? 
    // For now, let's Stick to strictly Sibling Reordering relative to the target's parent.

    const newParentId = overItem.parentDocumentId;

    // Calculate new position relative to siblings
    // We optimistically move it in the array

    let updates: any = {
      parentDocumentId: newParentId,
      position: overItem.position // We'll need refined position calc or just re-rank all siblings
    };

    // Refined Position Calc:
    // We need to re-sort the 'siblings' group and find a slot.
    // Or closer: insert 'after' or 'before' overItem.
    // dnd-kit gives us index in visibleItems.

    const oldIndex = visibleItems.findIndex(i => i.id === active.id);
    const newIndex = visibleItems.findIndex(i => i.id === over.id);

    let siblingItems = documents?.filter(d => d.parentDocumentId === newParentId)
      .sort((a, b) => a.position - b.position) || [];

    // Filter out self
    siblingItems = siblingItems.filter(d => d.id !== active.id);

    // Find where 'over' is in siblings
    const overSiblingIndex = siblingItems.findIndex(s => s.id === over.id);

    let newPos;
    if (oldIndex < newIndex) {
      // Dragging DOWN -> Insert AFTER over
      const next = siblingItems[overSiblingIndex + 1];
      const prev = siblingItems[overSiblingIndex];
      // If last
      if (!next) newPos = (prev?.position || 0) + 1000;
      else newPos = Math.floor(((prev?.position || 0) + next.position) / 2);
    } else {
      // Dragging UP -> Insert BEFORE over
      const prev = siblingItems[overSiblingIndex - 1];
      const next = siblingItems[overSiblingIndex];
      if (!prev) newPos = (next?.position || 0) - 1000;
      else newPos = Math.floor((prev.position + (next?.position || 0)) / 2);
    }

    updates.position = newPos;

    // 1. Capture State for Rollback
    const previousDocs = documents || [];

    // 2. Optimistic Update (Instant)
    const optimisticallyUpdatedDocs = previousDocs.map(d =>
      d.id === active.id ? { ...d, ...updates } : d
    );

    setDocuments(optimisticallyUpdatedDocs);
    sidebarCache.set("root", optimisticallyUpdatedDocs);
    mutate(optimisticallyUpdatedDocs, false); // Update SWR cache without revalidation
    toast.success("Order saved");

    // 3. Remote Sync (Background)
    update({ id: active.id as string, ...updates }).catch((error) => {
      console.error("Reorder failed:", error);
      toast.error("Failed to sync order");

      // 4. Rollback on Error
      setDocuments(previousDocs);
      sidebarCache.set("root", previousDocs);
      mutate(previousDocs, false);
    });
  };

  // Drag Overlay item
  const activeItem = activeId ? documents?.find((d) => d.id === activeId) : null;

  // Global Event Listener
  useEffect(() => {
    const handleChange = () => mutate();
    window.addEventListener("documents-changed", handleChange);
    return () => window.removeEventListener("documents-changed", handleChange);
  }, [mutate]);


  if (!documents) {
    return (
      <div className="pl-4">
        <Item.Skeleton level={0} />
        <Item.Skeleton level={0} />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={visibleIds}
        strategy={verticalListSortingStrategy}
      >
        <div>
          {visibleItems.map((doc) => (
            <SortableDocumentItem
              key={doc.id}
              document={doc}
              level={doc.depth} // Use 'depth' calculated from flattenTree
              onExpand={() => onExpand(doc.id)}
              expanded={expanded[doc.id]}
              active={params.documentId === doc.id}
            />
          ))}
          {/* Empty state for root */}
          {visibleItems.length === 0 && (
            <p className="text-sm font-medium text-muted-foreground/80 p-4">No Page Inside</p>
          )}
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <div className="opacity-90 shadow-2xl rotate-2">
            <Item
              id={activeItem.id}
              label={activeItem.title}
              icon={FileIcon}
              documentIcon={activeItem.icon || undefined}
              active={false}
              level={0} // Reset level for overlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
