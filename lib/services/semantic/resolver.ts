import { db } from "@/db";
import { semanticNodes } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { SemanticProposal } from "./policy";
import { ResolvedProposal } from "./anchor";

export interface INodeResolverService {
    resolve(proposals: SemanticProposal[], userId: string): Promise<ResolvedProposal[]>;
}

export const nodeResolverService: INodeResolverService = {
    resolve: async (proposals: SemanticProposal[], userId: string): Promise<ResolvedProposal[]> => {
        if (proposals.length === 0) return [];

        // 1. 批量拉取该用户下可能匹配的候选节点，优化数据库查询性能
        const uniqueTitles = [...new Set(proposals.map(p => p.title))];

        const candidates = await db.query.semanticNodes.findMany({
            where: and(
                eq(semanticNodes.userId, userId),
                inArray(semanticNodes.title, uniqueTitles)
            )
        });

        // 2. 将候选节点转为 Map 进行高效内存匹配 (Key: title|type)
        const nodeMap = new Map<string, string>();
        candidates.forEach(node => {
            const key = `${node.title.toLowerCase()}|${node.type.toLowerCase()}`;
            nodeMap.set(key, node.id);
        });

        // 3. 执行严格匹配逻辑
        const resolved: ResolvedProposal[] = [];

        for (const proposal of proposals) {
            const key = `${proposal.title.toLowerCase()}|${proposal.type.toLowerCase()}`;
            const nodeId = nodeMap.get(key);

            // 4. 匹配不到的立即丢弃，绝不创建新 Node
            if (nodeId) {
                resolved.push({
                    nodeId,
                    startOffset: proposal.startOffset,
                    endOffset: proposal.endOffset
                });
            }
        }

        // 5. 返回结果直接对接 AnchorSyncService.sync
        return resolved;
    }
};
