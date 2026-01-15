import { create } from "zustand";
import { getQaItems, createQaItem, updateQaItem, deleteQaItem } from "@/actions/qa";
import { toast } from "sonner";

export type QuestionType = "what" | "why" | "how" | "custom";
export type QuestionStatus = "unasked" | "asked";

export interface QuestionItem {
    id: string;
    text: string;
    type?: QuestionType;
    status: QuestionStatus;
    answer?: string;
    createdAt: number;
}

interface QaStore {
    items: QuestionItem[];
    isLoading: boolean;
    hydrate: () => Promise<void>;
    addItem: (text: string, type?: QuestionType) => Promise<void>;
    updateItem: (id: string, updates: Partial<QuestionItem>) => Promise<void>;
    removeItem: (id: string) => Promise<void>;
    markAsAsked: (id: string) => Promise<void>;
    markAsUnasked: (id: string) => Promise<void>;
}

export const useQaStore = create<QaStore>((set, get) => ({
    items: [],
    isLoading: false,

    hydrate: async () => {
        set({ isLoading: true });
        try {
            const items = await getQaItems();
            set({ items: items as QuestionItem[] });
        } catch (error) {
            console.error("Failed to hydrate QA items:", error);
            toast.error("Failed to load questions");
        } finally {
            set({ isLoading: false });
        }
    },

    addItem: async (text: string, type: QuestionType = "custom") => {
        // Optimistic update
        const tempId = Date.now().toString();
        const optimisticItem: QuestionItem = {
            id: tempId,
            text,
            type,
            status: "unasked",
            createdAt: Date.now(),
        };

        set((state) => ({
            items: [optimisticItem, ...state.items], // Add to top
        }));

        try {
            const newItem = await createQaItem(text, type);
            // Replace optimistic item with real one
            set((state) => ({
                items: state.items.map((item) =>
                    item.id === tempId ? (newItem as QuestionItem) : item
                ),
            }));
        } catch (error) {
            console.error("Failed to add item:", error);
            // Revert
            set((state) => ({
                items: state.items.filter((item) => item.id !== tempId),
            }));
            toast.error("Failed to save question");
        }
    },

    updateItem: async (id, updates) => {
        // Optimistic
        const previousItems = get().items;
        set((state) => ({
            items: state.items.map((item) =>
                item.id === id ? { ...item, ...updates } : item
            ),
        }));

        try {
            await updateQaItem(id, updates);
        } catch (error) {
            console.error("Failed to update item:", error);
            // Revert
            set({ items: previousItems });
            toast.error("Failed to update question");
        }
    },

    removeItem: async (id) => {
        // Optimistic
        const previousItems = get().items;
        set((state) => ({
            items: state.items.filter((item) => item.id !== id),
        }));

        try {
            await deleteQaItem(id);
        } catch (error) {
            console.error("Failed to delete item:", error);
            // Revert
            set({ items: previousItems });
            toast.error("Failed to delete question");
        }
    },

    markAsAsked: async (id) => {
        return get().updateItem(id, { status: "asked" });
    },

    markAsUnasked: async (id) => {
        return get().updateItem(id, { status: "unasked" });
    },
}));
