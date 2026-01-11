"use server";

import { db } from "@/db";
import { nodeSourceAnchors, semanticNodes, documentBlocks } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

/**
 * 获取文档的语义图谱数据
 * 节点：该文档下所有引用的 semantic_nodes
 * 边：在同一个 block 中共现的节点对
 */
export const getSemanticGraphData = async (documentId: string) => {
    try {
        // 1. 获取该文档下所有的 blocks
        const blocks = await db.query.documentBlocks.findMany({
            where: eq(documentBlocks.documentId, documentId),
        });
        const blockIds = blocks.map(b => b.id);

        if (blockIds.length === 0) return { nodes: [], links: [] };

        // 2. 获取这些 blocks 关联的所有 anchors
        const anchors = await db.query.nodeSourceAnchors.findMany({
            where: inArray(nodeSourceAnchors.blockId, blockIds),
        });

        // 3. 提取涉及的 unique nodeIds
        const nodeIds = [...new Set(anchors.map(a => a.nodeId))];
        if (nodeIds.length === 0) return { nodes: [], links: [] };

        // 4. 获取对应的节点详情
        const nodes = await db.query.semanticNodes.findMany({
            where: inArray(semanticNodes.id, nodeIds),
        });

        // 5. 构建边：按 blockId 分组计算共现
        const links: { source: string; target: string; blockId: string }[] = [];
        const anchorsByBlock = anchors.reduce((acc, a) => {
            if (!acc[a.blockId]) acc[a.blockId] = [];
            acc[a.blockId].push(a.nodeId);
            return acc;
        }, {} as Record<string, string[]>);

        for (const [blockId, involvedNodeIds] of Object.entries(anchorsByBlock)) {
            // 对每两个不同的节点建立一条线
            const uniqueInvolved = [...new Set(involvedNodeIds)];
            for (let i = 0; i < uniqueInvolved.length; i++) {
                for (let j = i + 1; j < uniqueInvolved.length; j++) {
                    links.push({
                        source: uniqueInvolved[i],
                        target: uniqueInvolved[j],
                        blockId
                    });
                }
            }
        }

        // 去重边 (Graph 层面通常不显示重复边)
        const uniqueLinks = links.filter((link, index, self) =>
            index === self.findIndex((t) => (
                (t.source === link.source && t.target === link.target) ||
                (t.source === link.target && t.target === link.source)
            ))
        );

        return {
            nodes: nodes.map(n => ({
                id: n.id,
                title: n.title,
                type: n.type,
            })),
            links: uniqueLinks
        };
    } catch (error) {
        console.error("[GET_GRAPH_DATA_ERROR]", error);
        return { nodes: [], links: [] };
    }
};
