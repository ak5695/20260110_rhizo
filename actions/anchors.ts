"use server";

import { db } from "@/db";
import { nodeSourceAnchors, semanticNodes, documentBlocks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * 用户主权操作 1: 创建新概念并绑定 (Manual Create)
 */
export const createManualAnchor = async ({
    blockId,
    documentId,
    userId,
    title,
    type,
    startOffset,
    endOffset,
    blockText,
    blockType,
    metadata
}: {
    blockId: string;
    documentId: string;
    userId: string;
    title: string;
    type: string;
    startOffset: number;
    endOffset: number;
    blockText?: string;
    blockType?: string;
    metadata?: any;
}) => {
    console.log("[Server-Action] createManualAnchor started", { blockId, documentId, title });
    try {
        // 0. 确保 Block 存在 (防御式编程)
        const existingBlock = await db.query.documentBlocks.findFirst({
            where: eq(documentBlocks.id, blockId)
        });

        if (!existingBlock && blockText && blockType) {
            console.log("[Server-Action] Block not found in DB, creating stub...");
            await db.insert(documentBlocks).values({
                id: blockId,
                documentId,
                type: blockType,
                text: blockText,
                order: 0, // 临时 order
            });
        }

        // 1. 寻找或创建节点 (确权唯一性)
        console.log("[Server-Action] Finding/Creating node...");

        // 规范化处理：去除前后空格
        const normalizedTitle = title.trim();

        let node = await db.query.semanticNodes.findFirst({
            where: and(
                eq(semanticNodes.userId, userId),
                eq(semanticNodes.title, normalizedTitle),
                eq(semanticNodes.type, type)
            )
        });

        if (!node) {
            console.log("[Server-Action] Node not found, attempting atomic insert...");
            try {
                const [newNode] = await db.insert(semanticNodes).values({
                    userId,
                    title: normalizedTitle,
                    type,
                    version: 1,
                    metadata: metadata || {}
                }).returning();
                node = newNode;
            } catch (e) {
                // 如果在 insert 瞬间别的进程插入了，再次查询即可
                console.log("[Server-Action] Insert conflict, falling back to query.");
                node = await db.query.semanticNodes.findFirst({
                    where: and(
                        eq(semanticNodes.userId, userId),
                        eq(semanticNodes.title, normalizedTitle),
                        eq(semanticNodes.type, type)
                    )
                });
            }
            if (!node) throw new Error("Failed to secure semantic node identity");
        }

        // 2. 创建锁定锚点
        console.log("[Server-Action] Creating anchor for nodeId:", node.id);
        await db.insert(nodeSourceAnchors).values({
            blockId,
            nodeId: node.id,
            startOffset,
            endOffset,
            provenance: 'USER',
            isLocked: true
        });
        console.log("[Server-Action] Anchor created successfully");

        revalidatePath(`/documents/${documentId}`);
        return { success: true, nodeId: node.id };
    } catch (error) {
        console.error("[Server-Action] [CREATE_MANUAL_ANCHOR_ERROR]", error);
        return { success: false, error: "Failed to create manual anchor" };
    }
};

/**
 * 用户主权操作 2: 关联已有概念 (Manual Link)
 */
export const linkExistingNode = async ({
    blockId,
    nodeId,
    startOffset,
    endOffset
}: {
    blockId: string;
    nodeId: string;
    startOffset: number;
    endOffset: number;
}) => {
    try {
        await db.insert(nodeSourceAnchors).values({
            blockId,
            nodeId,
            startOffset,
            endOffset,
            provenance: 'USER',
            isLocked: true
        });
        return { success: true };
    } catch (error) {
        console.error("[LINK_NODE_ERROR]", error);
        return { success: false, error: "Failed to link node" };
    }
};

/**
 * 用户主权操作 3: 接受 AI 建议 (Accept/Lock)
 * 哲学：将 AI 的提议确权为人类意志，物理锁定。
 */
export const acceptAiSuggestion = async (anchorId: string) => {
    console.log(`[Arbitration] Accepting anchorId=${anchorId}`);
    try {
        await db.update(nodeSourceAnchors)
            .set({ isLocked: true })
            .where(eq(nodeSourceAnchors.id, anchorId));

        console.log(`[Arbitration] Accepted anchorId=${anchorId} - Successfully Locked.`);
        return { success: true };
    } catch (error) {
        console.error("[ACCEPT_SUGGESTION_ERROR]", error);
        return { success: false, error: "Failed to accept suggestion" };
    }
};

/**
 * 用户主权操作 4: 拒绝 AI 建议 (Reject)
 * 哲学：将该区域标记为“人类禁止区”，AI 永世不得入内。
 */
export const rejectAiSuggestion = async (anchorId: string) => {
    console.log(`[Arbitration] Rejecting anchorId=${anchorId}`);
    try {
        await db.update(nodeSourceAnchors)
            .set({
                provenance: 'USER_REJECTED',
                isLocked: true
            })
            .where(eq(nodeSourceAnchors.id, anchorId));

        console.log(`[Arbitration] Rejected anchorId=${anchorId} - Marked as USER_REJECTED.`);
        return { success: true };
    } catch (error) {
        console.error("[REJECT_SUGGESTION_ERROR]", error);
        return { success: false, error: "Failed to reject suggestion" };
    }
};

/**
 * 用户主权操作 5: 修改节点名称 (Rename)
 * 哲学：用户可以随时重新定义“概念”的内涵。
 */
export const renameNode = async (nodeId: string, newTitle: string) => {
    const normalizedTitle = newTitle.trim();
    console.log(`[Arbitration] Renaming nodeId=${nodeId} to "${normalizedTitle}"`);

    try {
        // 1. 获取原节点信息
        const originalNode = await db.query.semanticNodes.findFirst({
            where: eq(semanticNodes.id, nodeId)
        });
        if (!originalNode) throw new Error("Source node not found");

        // 2. 检查目标名称是否在该用户下已存在 (合并判定)
        const targetNode = await db.query.semanticNodes.findFirst({
            where: and(
                eq(semanticNodes.userId, originalNode.userId),
                eq(semanticNodes.title, normalizedTitle),
                eq(semanticNodes.type, originalNode.type)
            )
        });

        if (targetNode && targetNode.id !== nodeId) {
            console.log(`[Arbitration] Conflict detected. Merging node ${nodeId} into ${targetNode.id}`);

            // 执行节点合并逻辑：
            // A. 将所有指向旧节点的锚点重定向到新节点
            await db.update(nodeSourceAnchors)
                .set({ nodeId: targetNode.id })
                .where(eq(nodeSourceAnchors.nodeId, nodeId));

            // B. 删除旧的冗余节点
            await db.delete(semanticNodes).where(eq(semanticNodes.id, nodeId));

            console.log(`[Arbitration] Merge complete. Identity unified to ${targetNode.id}`);
        } else {
            // 常规更名
            await db.update(semanticNodes)
                .set({
                    title: normalizedTitle,
                    updatedAt: new Date()
                })
                .where(eq(semanticNodes.id, nodeId));
            console.log(`[Arbitration] Standard rename successful.`);
        }

        return { success: true };
    } catch (error) {
        console.error("[RENAME_NODE_ERROR]", error);
        return { success: false, error: "Failed to rename (Identity conflict)" };
    }
};

/**
 * 辅助操作: 通过文本匹配查找对应的锚点
 * 用于在前端划选时自动识别是否存在 AI 提议
 */
export const findAnchorByText = async (blockId: string, text: string) => {
    try {
        const anchor = await db.query.nodeSourceAnchors.findFirst({
            where: eq(nodeSourceAnchors.blockId, blockId),
            with: {
                node: true
            }
        });

        // 简单的模糊匹配或精确匹配
        if (anchor && anchor.node.title.toLowerCase() === text.trim().toLowerCase()) {
            return {
                id: anchor.id,
                nodeId: anchor.nodeId,
                title: anchor.node.title,
                provenance: anchor.provenance
            };
        }
        return null;
    } catch (error) {
        console.error("[FIND_ANCHOR_ERROR]", error);
        return null;
    }
};
