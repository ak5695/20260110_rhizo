"use server";

import { db } from "@/db";
import { documentBlocks, documents, nodeSourceAnchors } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import {
    semanticAnalyzerService,
    conflictPolicyEngine,
    nodeResolverService,
    anchorSyncService
} from "@/lib/services/semantic";

/**
 * 语义同步的核心 Server Action
 * 执行流程：提取上下文 -> AI 分析 -> 冲突过滤 -> 节点消解 -> 物理同步
 */
export const triggerSemanticSync = async (blockId: string) => {
    try {
        // 1. 获取 block + document + userId
        const block = await db.query.documentBlocks.findFirst({
            where: eq(documentBlocks.id, blockId),
        });
        if (!block) throw new Error("Block not found");

        const doc = await db.query.documents.findFirst({
            where: eq(documents.id, block.documentId),
        });
        if (!doc) throw new Error("Document not found");

        const userId = doc.userId;

        // 获取邻近 block 作为上下文 (Context)
        const neighbors = await db.query.documentBlocks.findMany({
            where: eq(documentBlocks.documentId, block.documentId),
            orderBy: [asc(documentBlocks.order)],
        });
        const contextText = neighbors.map(b => b.text).join("\n");

        // 2. 获取该 block 的现有锚点记录，用于冲突判定
        const existingAnchors = await db.query.nodeSourceAnchors.findMany({
            where: eq(nodeSourceAnchors.blockId, blockId),
        });

        // 3. 调用 AI 解析器获取原始提议
        // 此处可传入已锁定的节点标题列表（可选优化）
        const rawProposals = await semanticAnalyzerService.analyze(
            block.text,
            contextText,
            []
        );

        // 4. 调用冲突策略引擎：应用锁定逻辑、拒绝名单和内部重叠过滤
        const validProposals = conflictPolicyEngine.resolve(
            rawProposals,
            existingAnchors.map(a => ({
                id: a.id,
                nodeId: a.nodeId,
                startOffset: a.startOffset,
                endOffset: a.endOffset,
                isLocked: a.isLocked,
                provenance: a.provenance as any,
            }))
        );

        // 5. 调用节点消解服务：严格匹配已存在节点
        // 核心约束：此处不创建新 Node，匹配不到的直接丢弃
        const resolvedProposals = await nodeResolverService.resolve(
            validProposals,
            userId
        );

        // 6. 调用锚点同步服务：执行物理的 DB 写入 (Transaction)
        await anchorSyncService.sync(blockId, resolvedProposals);

        return {
            success: true,
            matchedCount: resolvedProposals.length
        };

    } catch (error) {
        console.error("[triggerSemanticSync_FAILED]", error);
        return {
            success: false,
            error: (error as Error).message
        };
    }
};
