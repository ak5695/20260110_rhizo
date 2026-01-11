import { db } from "@/db";
import { nodeSourceAnchors } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export interface ResolvedProposal {
    nodeId: string;
    startOffset: number;
    endOffset: number;
}

export interface IAnchorSyncService {
    sync(blockId: string, finalProposals: ResolvedProposal[]): Promise<void>;
}

export const anchorSyncService: IAnchorSyncService = {
    sync: async (blockId: string, finalProposals: ResolvedProposal[]): Promise<void> => {
        // 1. 只删除 blockId 下 provenance='AI' 且 isLocked=false 的旧 anchor
        await db.delete(nodeSourceAnchors).where(
            and(
                eq(nodeSourceAnchors.blockId, blockId),
                eq(nodeSourceAnchors.provenance, 'AI'),
                eq(nodeSourceAnchors.isLocked, false)
            )
        );

        // 2. 批量插入由上层已经消解并解析好的新 anchor
        if (finalProposals.length > 0) {
            await db.insert(nodeSourceAnchors).values(
                finalProposals.map(p => ({
                    blockId,
                    nodeId: p.nodeId,
                    startOffset: p.startOffset,
                    endOffset: p.endOffset,
                    provenance: 'AI',
                    isLocked: false,
                }))
            );
        }
    }
};
