import { db } from "@/db";
import { documentBlocks } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * 将 BlockNote 的 JSON 内容同步到 document_blocks 表
 * 核心目的：为语义引擎提供结构化的文本查询基础
 */
export const syncBlocks = async (documentId: string, contentJson: string) => {
    try {
        const blocks = JSON.parse(contentJson);
        if (!Array.isArray(blocks)) return;

        // 1. 提取并清洗数据
        const blocksToUpsert = blocks.map((block: any, index: number) => {
            // 提取块内的纯文本 (BlockNote 的 content 可能是数组)
            let plainText = "";
            if (Array.isArray(block.content)) {
                plainText = block.content
                    .map((c: any) => (c.type === "text" ? c.text : ""))
                    .join("");
            }

            return {
                id: block.id,
                documentId,
                type: block.type,
                text: plainText,
                props: block.props || {},
                order: index,
                updatedAt: new Date(),
            };
        });

        // 2. 物理写入
        // 注意：neon-http 不支持事务，但我们可以先清理再插入，或者使用 ON CONFLICT
        // 这里使用删除旧的并批量插入新的方式 (简单且能处理块移动/删除)

        // TODO: 如果性能成为瓶颈，改为更精细的 diff 逻辑
        await db.delete(documentBlocks).where(eq(documentBlocks.documentId, documentId));

        if (blocksToUpsert.length > 0) {
            await db.insert(documentBlocks).values(blocksToUpsert);
        }

        console.log(`[BlockSync] Synced ${blocksToUpsert.length} blocks for doc ${documentId}`);
    } catch (error) {
        console.error("[BlockSync_ERROR]", error);
        throw error;
    }
};
