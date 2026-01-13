# 笔记创建性能优化 - Notion 级别实现

## 🐌 当前性能问题

### 瓶颈分析
```
用户点击创建 → 等待500-2000ms → 才能看到页面
```

**耗时分解**:
1. Auth验证: 50-100ms
2. 数据库INSERT: 100-300ms
3. 查询父文档: 50-150ms (if有父文档)
4. 更新父文档: 100-300ms (if有父文档)
5. revalidatePath: 50-100ms
6. 路由导航: 100-200ms

**总计**: 450-1150ms (无父文档) / 700-2000ms (有父文档)

---

## ⚡ Notion 的优化策略

### 核心原理
> **立即响应 + 后台同步 + 失败补偿**

```
用户点击 → 0ms → 立即显示空白页 → 后台静默创建
```

---

## 🎯 优化方案

### 方案1: 乐观UI + 懒加载父文档更新 (推荐)

#### 客户端优化 (`components/main/navigation.tsx`)
```typescript
const handleCreate = () => {
  const tempId = crypto.randomUUID();

  // ✅ 1. 立即导航 (0ms)
  router.push(`/documents/${tempId}`);

  // ✅ 2. 后台创建 (非阻塞)
  const promise = create({
    id: tempId,
    title: "Untitled"
  }).then(() => {
    window.dispatchEvent(new CustomEvent("documents-changed"));
  });

  // ✅ 3. 静默Toast (不阻塞)
  toast.promise(promise, {
    loading: "Initializing...",
    success: "Ready",
    error: "Sync failed"
  }, { id: "create-doc" });
};
```

**现状**: ✅ 已实现！

#### 服务端优化 (`actions/documents.ts`)

**问题**: 父文档更新阻塞创建流程

**优化**: 将父文档更新改为异步任务

```typescript
export const create = async (args: {
  id?: string,
  title: string,
  parentDocumentId?: string
}) => {
  const user = await getUser()
  if (!user) throw new Error("Unauthorized")

  // ✅ 快速创建文档
  const newDoc = await safeCreateDocument({
    id: args.id,
    title: args.title,
    userId: user.id,
    parentDocumentId: args.parentDocumentId,
  })

  // ✅ 父文档更新改为异步（不阻塞返回）
  if (args.parentDocumentId) {
    // 使用 setTimeout 或 消息队列
    Promise.resolve().then(async () => {
      try {
        const parent = await getDocumentWithVersion(args.parentDocumentId!, user.id);
        if (parent) {
          let content: any[] = parent.document.content ? JSON.parse(parent.document.content) : [];

          const pageBlock = {
            id: Math.random().toString(36).substring(2, 11),
            type: "page",
            props: { pageId: newDoc.id, title: args.title },
            children: []
          };

          content.push(pageBlock);

          await safeUpdateDocument({
            documentId: parent.document.id,
            updates: { content: JSON.stringify(content) },
            options: { expectedVersion: parent.version, userId: user.id }
          });

          await documentCache.invalidate(parent.document.id);
        }
      } catch (error) {
        console.error("[NotionSync] Async parent link failed:", error);
      }
    });
  }

  // ✅ 立即返回（不等待父文档更新）
  revalidatePath("/documents")
  return newDoc
}
```

**性能提升**: 700-2000ms → 150-400ms (提升75-80%)

---

### 方案2: 客户端缓存 + 预加载

#### 实现空白页本地模板

```typescript
// lib/optimistic-create.ts
const EMPTY_DOC_TEMPLATE = {
  id: '',
  title: 'Untitled',
  content: '[]', // 空白BlockNote文档
  userId: '',
  isArchived: false,
  isPublished: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 0
};

export function createOptimisticDocument(id: string, userId: string) {
  return {
    ...EMPTY_DOC_TEMPLATE,
    id,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}
```

#### 客户端使用

```typescript
const handleCreate = () => {
  const tempId = crypto.randomUUID();
  const user = session?.user;

  // ✅ 1. 本地创建文档对象
  const optimisticDoc = createOptimisticDocument(tempId, user.id);

  // ✅ 2. 设置到缓存（SWR/TanStack Query）
  mutate(['document', tempId], optimisticDoc, false);

  // ✅ 3. 立即导航
  router.push(`/documents/${tempId}`);

  // ✅ 4. 后台真实创建
  create({ id: tempId, title: "Untitled" })
    .then(() => mutate(['document', tempId])) // 刷新真实数据
    .catch(() => {
      // 回滚乐观更新
      mutate(['document', tempId], undefined, false);
      router.push('/documents');
    });
};
```

---

### 方案3: 批量创建优化（针对快速连续创建）

#### 问题
用户快速创建多个笔记时，每次都调用服务端

#### 解决
```typescript
// lib/batch-create.ts
class DocumentBatchCreator {
  private queue: Array<{ id: string, title: string }> = [];
  private timer: NodeJS.Timeout | null = null;

  addToQueue(id: string, title: string) {
    this.queue.push({ id, title });

    if (this.timer) clearTimeout(this.timer);

    this.timer = setTimeout(() => {
      this.flush();
    }, 100); // 100ms批量窗口
  }

  async flush() {
    if (this.queue.length === 0) return;

    const batch = [...this.queue];
    this.queue = [];

    // 批量创建API
    await createBatch(batch);
  }
}

export const batchCreator = new DocumentBatchCreator();
```

---

## 📊 性能对比

| 方案 | 创建时间 | 用户感知 | 实现复杂度 |
|------|---------|---------|-----------|
| **当前** | 700-2000ms | 很慢 | - |
| **方案1** | 150-400ms | 快 | ⭐⭐ (推荐) |
| **方案2** | <50ms | 瞬间 | ⭐⭐⭐⭐ |
| **方案3** | <50ms | 瞬间 | ⭐⭐⭐ |

---

## 🚀 实施步骤

### 阶段1: 快速优化（方案1）
1. ✅ 客户端乐观导航（已实现）
2. ⏳ 服务端异步父文档更新
3. ⏳ 移除不必要的revalidatePath

**预计收益**: 75-80% 性能提升

### 阶段2: 深度优化（方案2）
1. 实现客户端文档缓存
2. 添加乐观更新机制
3. 实现失败回滚

**预计收益**: 95% 性能提升

### 阶段3: 极致优化（方案3）
1. 实现批量创建API
2. 添加请求合并
3. 优化数据库INSERT

**预计收益**: 适用于批量场景

---

## 🔍 Notion 的实现细节

### 核心技术
1. **乐观UI**: 立即渲染，后台同步
2. **本地优先**: 客户端缓存 + IndexedDB
3. **增量同步**: WebSocket实时更新
4. **冲突解决**: CRDT算法

### 时间线
```
0ms    → 用户点击
0ms    → 立即显示空白页（本地模板）
50ms   → 后台发起创建请求
200ms  → 数据库INSERT完成
250ms  → 客户端收到确认
300ms  → 静默更新文档ID
```

**用户感知**: 瞬间创建！

---

## ⚠️ 注意事项

### 错误处理
```typescript
// 乐观创建失败时的回滚
try {
  await create({ id: tempId, title: "Untitled" });
} catch (error) {
  // 1. 显示错误提示
  toast.error("Failed to create note. Please try again.");

  // 2. 回退路由
  router.push('/documents');

  // 3. 清理本地状态
  mutate(['document', tempId], undefined, false);
}
```

### 并发控制
```typescript
// 防止重复创建
const creatingIds = new Set<string>();

async function createWithLock(id: string, title: string) {
  if (creatingIds.has(id)) {
    console.warn('[Create] Already creating:', id);
    return;
  }

  creatingIds.add(id);
  try {
    await create({ id, title });
  } finally {
    creatingIds.delete(id);
  }
}
```

---

## 📝 总结

### 推荐实施方案
**方案1（异步父文档更新）** - 性价比最高
- 实现简单（10行代码）
- 性能提升75-80%
- 兼容现有架构
- 无需客户端改动

### 后续优化
1. 添加IndexedDB离线缓存
2. 实现WebSocket实时同步
3. 优化数据库查询（添加索引）
4. 使用CDN缓存静态资源

---

**目标**: 实现 Notion 级别的创建体验 (<50ms)
