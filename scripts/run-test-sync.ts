import "dotenv/config";
import { triggerSemanticSync } from "../actions/semantic";
import { db } from "../db";
import { nodeSourceAnchors, semanticNodes } from "../db/schema";
import { eq } from "drizzle-orm";

async function main() {
    const BLOCK_ID = "00000000-0000-0000-0000-000000000001";

    console.log("🚀 开始执行 triggerSemanticSync...");
    const result = await triggerSemanticSync(BLOCK_ID);
    console.log("执行结果:", JSON.stringify(result, null, 2));

    console.log("\n📊 查询数据库状态...");
    const anchors = await db.select({
        nodeId: nodeSourceAnchors.nodeId,
        title: semanticNodes.title,
        start: nodeSourceAnchors.startOffset,
        end: nodeSourceAnchors.endOffset,
        provenance: nodeSourceAnchors.provenance,
        isLocked: nodeSourceAnchors.isLocked
    })
        .from(nodeSourceAnchors)
        .leftJoin(semanticNodes, eq(nodeSourceAnchors.nodeId, semanticNodes.id))
        .where(eq(nodeSourceAnchors.blockId, BLOCK_ID));

    console.log("数据库记录 (node_source_anchors):");
    console.table(anchors);

    process.exit(0);
}

main().catch(err => {
    console.error("执行出错:", err);
    process.exit(1);
});
