import { db } from "@/db";
import { documentBlocks } from "@/db/schema";
import { documentCanvasBindings } from "@/db/canvas-schema";
import { eq, and, notInArray, ne } from "drizzle-orm";

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

        // 3. 协调绑定关系 (Reconciliation)
        // 目的：当 Block 被删除时，对应的 Binding 也应该被标记为无效

        // 获取该文档当前所有有效的 Block IDs
        const validBlockIds = new Set(blocksToUpsert.map(b => b.id));

        // 查找所有关联到该文档、但 Block ID 已不存在的活跃绑定

        // 只有当有效 Block 存在时才执行批量检查（避免全空文档的边缘情况误判）
        if (validBlockIds.size > 0) {
            const orphanedBindings = await db
                .select({ id: documentCanvasBindings.id })
                .from(documentCanvasBindings)
                .where(
                    and(
                        eq(documentCanvasBindings.documentId, documentId),
                        // 状态不是 'deleted' 的
                        ne(documentCanvasBindings.status, "deleted"),
                        // Block ID 不在有效列表中
                        notInArray(documentCanvasBindings.blockId, Array.from(validBlockIds))
                    )
                );

            if (orphanedBindings.length > 0) {
                const orphanedIds = orphanedBindings.map(b => b.id);
                console.log(`[BlockSync] Found ${orphanedIds.length} orphaned bindings. Cleaning up...`);

                // 批量标记为 deleted
                await db
                    .update(documentCanvasBindings)
                    .set({
                        status: "deleted",
                        updatedAt: new Date(),
                        // provenance: "auto_cleanup" // Optional: if field exists
                    })
                    .where(
                        and(
                            eq(documentCanvasBindings.documentId, documentId),
                            notInArray(documentCanvasBindings.blockId, Array.from(validBlockIds))
                        )
                    );
            }
        }
    } catch (error) {
        console.error("[BlockSync_ERROR]", error);
        throw error;
    }
};
