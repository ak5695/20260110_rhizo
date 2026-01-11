import { create } from "zustand";

interface SemanticSyncStore {
    activeNodeId: string | null;
    focusedAnchorId: string | null;
    setActiveNode: (nodeId: string | null) => void;
    setFocusedAnchor: (anchorId: string | null) => void;
}

/**
 * 语义共振中枢：用于协调图谱与文档之间的双向联动
 */
export const useSemanticSync = create<SemanticSyncStore>((set) => ({
    activeNodeId: null,
    focusedAnchorId: null,
    setActiveNode: (nodeId) => set({ activeNodeId: nodeId }),
    setFocusedAnchor: (anchorId) => set({ focusedAnchorId: anchorId }),
}));
