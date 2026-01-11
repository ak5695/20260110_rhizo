import { SemanticProposal } from "./policy";

export interface ISemanticAnalyzer {
    analyze(text: string, context: string, lockedTitles: string[]): Promise<SemanticProposal[]>;
}

/**
 * MOCK 实现：用于验证语义同步流水线的冲突与过滤算法
 */
export const semanticAnalyzerService: ISemanticAnalyzer = {
    analyze: async (text, context, lockedTitles) => {
        return [
            // 1. 与已锁定锚点重叠 (假设现有锁在 [10, 20])
            {
                title: "OverlappingWithLocked",
                type: "test",
                startOffset: 15,
                endOffset: 25
            },
            // 2. 命中 USER_REJECTED (假设 "BadNode" 在拒绝名单中)
            {
                title: "BadNode",
                type: "test",
                startOffset: 30,
                endOffset: 45
            },
            // 3. 两个提案互相重叠 (A: 50-70, B: 60-80) -> 应只保留 A
            {
                title: "Overlap_A_Earlier",
                type: "test",
                startOffset: 50,
                endOffset: 70
            },
            {
                title: "Overlap_B_Later",
                type: "test",
                startOffset: 60,
                endOffset: 80
            },
            // 4. 合法提案 (前提是数据库中已存在同名 Node，否则会被 Resolver 过滤)
            {
                title: "Drizzle ORM",
                type: "technology",
                startOffset: 100,
                endOffset: 115
            }
        ];
    }
};
