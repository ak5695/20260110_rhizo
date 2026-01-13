/**
 * Document Store - Zustand Global State for Real-time Sync
 * 
 * This store manages document metadata (title, icon) with:
 * 1. Instant UI updates across all components
 * 2. Debounced persistence to backend
 * 3. Optimistic updates with rollback on failure
 * 
 * Industry Pattern: Single source of truth for document state
 */

import { create } from "zustand";
import { writeQueue } from "@/lib/write-queue";

interface DocumentMetadata {
    id: string;
    title: string;
    icon?: string | null;
    version: number;
    userId: string;
}

interface DocumentStore {
    // State: Map of documentId -> metadata
    documents: Map<string, DocumentMetadata>;

    // Actions
    setDocument: (doc: DocumentMetadata) => void;
    updateTitle: (documentId: string, title: string) => void;
    updateIcon: (documentId: string, icon: string | null) => void;
    getDocument: (documentId: string) => DocumentMetadata | undefined;
    clearDocument: (documentId: string) => void;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
    documents: new Map(),

    /**
     * Initialize or sync document's metadata
     */
    setDocument: (doc: DocumentMetadata) => {
        const existing = get().documents.get(doc.id);

        // background sync: Update only if version is newer, but preserve local live edits
        if (!existing || doc.version > existing.version) {
            set((state) => {
                const newDocs = new Map(state.documents);
                const isBusy = writeQueue.hasPendingWrites(doc.id);

                newDocs.set(doc.id, {
                    ...doc,
                    // If we are currently typing (busy), keep our local title/icon
                    title: isBusy && existing ? existing.title : doc.title,
                    icon: isBusy && existing ? existing.icon : doc.icon,
                });
                return { documents: newDocs };
            });
        }
    },

    /**
     * Update title with instant UI feedback + debounced persistence
     */
    updateTitle: (documentId: string, title: string) => {
        const doc = get().documents.get(documentId);
        if (!doc) return;

        // 1. Instant UI update (optimistic)
        set((state) => {
            const newDocs = new Map(state.documents);
            newDocs.set(documentId, { ...doc, title });
            return { documents: newDocs };
        });

        // 2. Debounced persistence to backend
        writeQueue.queueUpdate({
            documentId,
            fieldName: "title",
            updates: { title: title || "Untitled" },
            version: doc.version,
            userId: doc.userId,
        }).catch((error) => {
            console.error("[DocumentStore] Failed to persist title:", error);
            // Rollback on failure - restore previous title
            set((state) => {
                const newDocs = new Map(state.documents);
                newDocs.set(documentId, doc);
                return { documents: newDocs };
            });
        });
    },

    /**
     * Update icon with instant UI feedback + immediate persistence
     */
    updateIcon: (documentId: string, icon: string | null) => {
        const doc = get().documents.get(documentId);
        if (!doc) return;

        // 1. Instant UI update
        set((state) => {
            const newDocs = new Map(state.documents);
            newDocs.set(documentId, { ...doc, icon });
            return { documents: newDocs };
        });

        // 2. Immediate persistence (icons are instant, no debounce)
        writeQueue.queueUpdate({
            documentId,
            fieldName: "icon",
            updates: { icon },
            version: doc.version,
            userId: doc.userId,
        }).catch((error) => {
            console.error("[DocumentStore] Failed to persist icon:", error);
        });
    },

    /**
     * Get document metadata
     */
    getDocument: (documentId: string) => {
        return get().documents.get(documentId);
    },

    /**
     * Clear document from store (on navigation away)
     */
    clearDocument: (documentId: string) => {
        set((state) => {
            const newDocs = new Map(state.documents);
            newDocs.delete(documentId);
            return { documents: newDocs };
        });
    },
}));

// Event listener for write success to keep version in sync without SWR delay
if (typeof window !== "undefined") {
    window.addEventListener("write-success", (e: any) => {
        const { doc } = e.detail;
        if (doc) {
            useDocumentStore.getState().setDocument(doc);
        }
    });
}

/**
 * Hook for subscribing to a specific document's metadata
 */
export const useDocumentTitle = (documentId: string) => {
    return useDocumentStore((state) => state.documents.get(documentId)?.title);
};

export const useDocumentIcon = (documentId: string) => {
    return useDocumentStore((state) => state.documents.get(documentId)?.icon);
};

export const useDocument = (documentId: string) => {
    return useDocumentStore((state) => state.documents.get(documentId));
};
