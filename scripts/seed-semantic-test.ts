import "dotenv/config";
import { db } from "../db";
import { documents, documentBlocks, semanticNodes, nodeSourceAnchors, user } from "../db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

async function main() {
    console.log("⏳ 正在构造语义测试地基数据...");

    // 1. 获取一个有效用户（由于有外键约束，必须绑定到真实用户）
    const currentUser = await db.query.user.findFirst();
    console.log("Current user lookup done:", !!currentUser);
    if (!currentUser) {
        throw new Error("数据库中没有用户，请先登录项目创建一个用户。");
    }
    const userId = currentUser.id;

    // 2. 创建测试文档
    const [doc] = await db.insert(documents).values({
        title: "语义流水线测试文档",
        userId: userId,
        lastModifiedBy: userId,
    }).returning();
    console.log("Document created:", doc.id);

    // 3. 创建测试 Block (ID 固定为 TEST_BLOCK_ID)
    const TEST_BLOCK_ID = "00000000-0000-0000-0000-000000000001"; // 使用标准 UUID 格式

    // 先清理可能存在的旧测试数据
    await db.delete(nodeSourceAnchors).where(eq(nodeSourceAnchors.blockId, TEST_BLOCK_ID));
    await db.delete(documentBlocks).where(eq(documentBlocks.id, TEST_BLOCK_ID));

    await db.insert(documentBlocks).values({
        id: TEST_BLOCK_ID,
        documentId: doc.id,
        type: "paragraph",
        text: "这是一个超过一百二十个字符的测试文本。Drizzle ORM 是一个非常棒的工具，它的语义系统正在被严格测试中。我们需要确保 Overlap_A_Earlier 和 BadNode 都能被正确处理。这是一段冗长的填充文字，用来保证 Offset 100 之后依然有内容可供锚点定位。",
        order: 0,
    });

    // 4. 创建语义节点 (Semantic Nodes)
    const [nodeDrizzle] = await db.insert(semanticNodes).values({
        title: "Drizzle ORM",
        type: "technology",
        userId: userId,
    }).returning();

    const [nodeOverlap] = await db.insert(semanticNodes).values({
        title: "Overlap_A_Earlier",
        type: "test",
        userId: userId,
    }).returning();

    const [nodePreExisting] = await db.insert(semanticNodes).values({
        title: "PreExisting",
        type: "test",
        userId: userId,
    }).returning();

    const [nodeBad] = await db.insert(semanticNodes).values({
        title: "BadNode",
        type: "test",
        userId: userId,
    }).returning();

    // 5. 创建初始锚点 (Anchors)

    // 5.1 锁定锚点 [10, 20] -> 将拦截 OverlappingWithLocked [15, 25]
    await db.insert(nodeSourceAnchors).values({
        blockId: TEST_BLOCK_ID,
        nodeId: nodePreExisting.id,
        startOffset: 10,
        endOffset: 20,
        isLocked: true,
        provenance: 'USER',
    });

    // 5.2 拒绝锚点 -> 标记 BadNode 为不希望出现的语义
    await db.insert(nodeSourceAnchors).values({
        blockId: TEST_BLOCK_ID,
        nodeId: nodeBad.id,
        startOffset: 30,
        endOffset: 45,
        isLocked: true,
        provenance: 'USER_REJECTED',
    });

    console.log("✅ 测试地基数据构造完成！");
    console.log(`- Document ID: ${doc.id}`);
    console.log(`- Block ID: ${TEST_BLOCK_ID}`);
    console.log("- 已注入：1个锁定区 [10-20], 1个拒绝节点 [BadNode], 2个可匹配节点 [Drizzle ORM, Overlap_A_Earlier]");
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
