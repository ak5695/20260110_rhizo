// lib/services/semantic/policy.ts

export type Provenance = 'AI' | 'USER' | 'HYBRID' | 'USER_REJECTED';

export interface SemanticProposal {
    title: string;
    type: string;
    startOffset: number;
    endOffset: number;
}

export interface ExistingAnchor {
    id: string;
    nodeId: string;
    startOffset: number;
    endOffset: number;
    isLocked: boolean;
    provenance: Provenance;
}

export interface IConflictPolicyEngine {
    resolve(proposals: SemanticProposal[], existing: ExistingAnchor[]): SemanticProposal[];
}

export const conflictPolicyEngine: IConflictPolicyEngine = {
    resolve: (proposals: SemanticProposal[], existing: ExistingAnchor[]): SemanticProposal[] => {
        const lockedAnchors = existing.filter(a => a.isLocked);

        const isOverlapping = (
            start1: number,
            end1: number,
            start2: number,
            end2: number
        ) => {
            return Math.max(start1, start2) < Math.min(end1, end2);
        };

        // 1. 丢弃与 isLocked=true 的 anchor 有重叠的 proposal
        let filtered = proposals.filter(p => {
            const hitLocked = lockedAnchors.some(a =>
                isOverlapping(p.startOffset, p.endOffset, a.startOffset, a.endOffset)
            );
            return !hitLocked;
        });

        // 2. proposal 之间互相重叠：只保留 startOffset 最小的
        filtered.sort((a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset);

        const result: SemanticProposal[] = [];

        for (const proposal of filtered) {
            const conflict = result.some(r =>
                isOverlapping(
                    proposal.startOffset,
                    proposal.endOffset,
                    r.startOffset,
                    r.endOffset
                )
            );

            if (!conflict) {
                result.push(proposal);
            }
        }

        return result;
    }
};