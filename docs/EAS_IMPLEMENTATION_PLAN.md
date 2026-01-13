# Existence Arbitration System (EAS) 实施计划

## 执行总结

实现一个**存在性仲裁引擎**，解决当前 Canvas-Document 绑定系统的三层状态不一致问题：
1. `canvasElements.isDeleted` (软删除)
2. `documentCanvasBindings` 记录（当前硬删除）
3. Document `canvasLink` 样式（需手动同步）

**核心原则**: BindingEntity.status 是唯一真相源，Canvas 和 Document 只是投影。

---

## 架构问题与解决方案

### 当前问题
```
❌ Canvas删除 → 硬删除绑定记录 → Editor手动移除样式
   - 事件可能丢失（刷新页面）
   - 状态不一致（幽灵绑定）
   - 无法恢复（硬删除）

❌ 事务边界不清晰
   - saveCanvasElements() 和 deleteBindings() 分离
   - 失败无法回滚

❌ Soft Delete vs Hard Delete 混淆
   - Canvas: isDeleted=true (可恢复)
   - Binding: DELETE (不可恢复)
```

### 解决方案
```
✅ 引入 status 状态机: 'visible' | 'hidden' | 'deleted' | 'pending'
✅ 所有操作只修改 status，不删除记录
✅ 事件驱动 + 持久化队列（防丢失）
✅ O(1) 性能（内存索引）
✅ 完整审计追踪
```

---

## 实施阶段

### 阶段1: 数据库架构（2-3小时）

#### 1.1 新增表结构

**binding_status_log** - 状态变更历史
```sql
- id, binding_id, status, previous_status
- transition_type, transition_reason
- actor_id, actor_type ('user' | 'system' | 'ai')
- created_at, metadata
索引: (binding_id), (created_at DESC)
```

**binding_inconsistencies** - 冲突检测
```sql
- id, binding_id, type ('orphaned' | 'missing-element' | 'status-mismatch')
- detected_at, detected_by, binding_status, element_deleted
- suggested_resolution, resolution_confidence
- resolved_at, resolved_by, resolution_action
索引: (resolved_at) WHERE NULL, (binding_id)
```

**binding_existence_cache** - 性能缓存
```sql
- binding_id (PK), status, element_exists, element_deleted, mark_exists
- last_verified_at, cache_version, is_stale
索引: (status), (is_stale) WHERE true
```

#### 1.2 修改现有表

**document_canvas_bindings**
```sql
ADD COLUMN current_status VARCHAR(20) DEFAULT 'visible'
  CHECK (current_status IN ('visible', 'hidden', 'deleted', 'pending'))
ADD COLUMN status_updated_at TIMESTAMP
ADD COLUMN status_updated_by TEXT REFERENCES "user"(id)

CREATE INDEX idx_bindings_status ON document_canvas_bindings(current_status)
```

#### 1.3 数据迁移

```sql
-- 回填 current_status 基于现有数据
UPDATE document_canvas_bindings dcb
SET current_status = CASE
  WHEN ce.is_deleted = true THEN 'hidden'
  WHEN ce.id IS NULL THEN 'deleted'
  ELSE 'visible'
END
FROM canvas_elements ce
WHERE dcb.element_id = ce.id AND dcb.canvas_id = ce.canvas_id;

-- 创建初始日志
INSERT INTO binding_status_log (binding_id, status, transition_type, actor_type)
SELECT id, current_status, 'system_reconcile', 'system'
FROM document_canvas_bindings;
```

**关键文件**: `/Users/aki5695/code/20260110_jotion/db/canvas-schema.ts`

---

### 阶段2: ExistenceEngine 核心实现（4-5小时）

#### 2.1 创建核心引擎

**文件**: `/Users/aki5695/code/20260110_jotion/lib/existence-engine.ts`

**核心类**:
```typescript
class ExistenceEngine extends EventEmitter {
  // 内存索引（O(1)）
  private statusMap: Map<bindingId, Status>
  private elementIdMap: Map<elementId, bindingId>
  private blockIdMap: Map<blockId, Set<bindingId>>

  // 核心操作（幂等）
  async hide(bindingId, actorId?): Promise<void>
  async show(bindingId, actorId?): Promise<void>
  async softDelete(bindingId, actorId?): Promise<void>
  async restore(bindingId, actorId?): Promise<void>

  // 批量操作
  async hideMany(bindingIds[], actorId?): Promise<void>
  async hideByElementIds(elementIds[], actorId?): Promise<number>

  // 查询（O(1)）
  getStatus(bindingId): Status
  getBindingsByStatus(status): bindingId[]
  getBindingByElementId(elementId): bindingId | undefined

  // 仲裁
  async reconcile(canvasId, autoFix): Promise<ReconcileResult>
  async detectInconsistencies(canvasId): Promise<Inconsistency[]>

  // 人类裁决
  async approve(bindingId, userId): Promise<void>
  async reject(bindingId, userId, reason): Promise<void>
}
```

**关键实现**:
- `transitionStatus()` - 原子状态转换（带事务）
- 状态转换规则验证
- 事件发射（双通道：Node EventEmitter + window.dispatchEvent）
- 内存索引自动更新

#### 2.2 事件系统

**文件**: `/Users/aki5695/code/20260110_jotion/lib/existence-event-bus.ts`

```typescript
class ExistenceEventBus {
  private queue: ExistenceEvent[]

  async publish(event): Promise<void>  // 持久化到 localStorage
  private processQueue(): Promise<void>  // 带重试（最多3次）
  restoreQueue(): void  // 页面加载时恢复
}
```

**事件类型**:
- `binding:hidden` - 绑定被隐藏
- `binding:shown` - 绑定被显示
- `binding:deleted` - 绑定被删除
- `binding:restored` - 绑定被恢复
- `binding:status-changed` - 通用状态变更
- `binding:approved` - 人类批准
- `binding:rejected` - 人类拒绝

**持久化机制**: 防止页面刷新导致事件丢失

---

### 阶段3: Canvas 集成（1-2小时）

**文件**: `/Users/aki5695/code/20260110_jotion/components/excalidraw-canvas.tsx`

#### 修改点1: 删除检测（第343-381行）

**替换**:
```typescript
// 旧代码
const { deleteBindingsByElementIds } = await import('@/actions/canvas-bindings');
const result = await deleteBindingsByElementIds(canvasId, newlyDeletedIds);

// 新代码
import { existenceEngine } from '@/lib/existence-engine';
const hiddenCount = await existenceEngine.hideByElementIds(newlyDeletedIds);
console.log('[Canvas] Hid', hiddenCount, 'bindings via ExistenceEngine');
```

**效果**:
- ✅ 不再硬删除绑定记录
- ✅ 设置 status='hidden'
- ✅ 自动触发 `binding:hidden` 事件

#### 修改点2: 初始化（第211-232行）

**添加**:
```typescript
useEffect(() => {
  const initEngine = async () => {
    if (canvasId) {
      await existenceEngine.initialize(canvasId);

      // 启动和解（可选，自动修复不一致）
      const result = await existenceEngine.reconcile(canvasId, true);
      if (result.autoFixed > 0) {
        toast.info(`Auto-fixed ${result.autoFixed} inconsistencies`);
      }
    }
  };
  initEngine();
}, [canvasId]);
```

#### 修改点3: 监听恢复事件（新增）

```typescript
useEffect(() => {
  const handleBindingShown = (e: CustomEvent) => {
    const { bindingId, elementId } = e.detail;

    // 恢复 Canvas 元素
    const elements = excalidrawAPI.getSceneElements();
    const element = elements.find((el: any) => el.id === elementId);

    if (element && element.isDeleted) {
      excalidrawAPI.updateScene({
        elements: elements.map((el: any) =>
          el.id === elementId ? { ...el, isDeleted: false } : el
        )
      });
      console.log('[Canvas] Restored element:', elementId);
    }
  };

  window.addEventListener('binding:shown', handleBindingShown as EventListener);
  return () => window.removeEventListener('binding:shown', handleBindingShown as EventListener);
}, [excalidrawAPI]);
```

---

### 阶段4: Editor 集成（1-2小时）

**文件**: `/Users/aki5695/code/20260110_jotion/components/editor.tsx`

#### 修改点1: 替换删除监听器（第712-774行）

**替换**:
```typescript
// 旧代码: 'binding:element-deleted' 监听器
// 复杂的 DOM 操作 + BlockNote API 调用

// 新代码: 简化为 CSS 样式控制
useEffect(() => {
  const handleBindingHidden = (e: CustomEvent) => {
    const { bindingId, elementId } = e.detail;
    console.log('[Editor] Binding hidden:', bindingId, elementId);

    // 从 state 移除
    setBindings(prev => prev.filter(b => b.id !== bindingId));

    // 应用 CSS ghosting（非破坏性）
    const boundTexts = document.querySelectorAll(
      `.canvas-bound-text[data-canvas-link="${elementId}"]`
    );
    boundTexts.forEach(el => el.classList.add('is-deleted'));
  };

  const handleBindingShown = (e: CustomEvent) => {
    const { bindingId, elementId } = e.detail;
    console.log('[Editor] Binding shown:', bindingId, elementId);

    // 移除 ghosting
    const boundTexts = document.querySelectorAll(
      `.canvas-bound-text[data-canvas-link="${elementId}"]`
    );
    boundTexts.forEach(el => el.classList.remove('is-deleted'));

    // 可选：重新加载 bindings
    window.dispatchEvent(new Event('refresh-bindings'));
  };

  window.addEventListener('binding:hidden', handleBindingHidden as EventListener);
  window.addEventListener('binding:shown', handleBindingShown as EventListener);

  return () => {
    window.removeEventListener('binding:hidden', handleBindingHidden as EventListener);
    window.removeEventListener('binding:shown', handleBindingShown as EventListener);
  };
}, []);
```

**优势**:
- ✅ 不再需要复杂的 BlockNote API 调用
- ✅ 使用 CSS 类控制显隐（性能更好）
- ✅ 可恢复（CSS 类可移除）
- ✅ 代码量减少 70%

#### 修改点2: 添加 CSS 样式

**文件**: `/Users/aki5695/code/20260110_jotion/app/globals.css`

```css
/* Binding 隐藏状态 */
.canvas-bound-text.is-deleted {
  text-decoration: line-through;
  opacity: 0.4;
  color: #999;
  transition: opacity 0.2s ease;
}

/* Pending 状态（人类裁决） */
.canvas-bound-text.is-pending {
  background: linear-gradient(to right, #fbbf24, #f59e0b);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  animation: pulse 2s ease-in-out infinite;
}

.canvas-bound-text.is-pending::before {
  content: "⚖️ ";
  color: #f59e0b;
}
```

---

### 阶段5: Server Actions 更新（1小时）

**文件**: `/Users/aki5695/code/20260110_jotion/actions/canvas-bindings.ts`

#### 新增 Actions

```typescript
/**
 * 隐藏绑定（通过 ExistenceEngine）
 */
export async function hideBindings(bindingIds: string[], userId?: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { success: false, error: "Unauthorized" };

  await existenceEngine.hideMany(bindingIds, userId || session.user.id);
  return { success: true, count: bindingIds.length };
}

/**
 * 显示绑定
 */
export async function showBindings(bindingIds: string[], userId?: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { success: false, error: "Unauthorized" };

  await existenceEngine.showMany(bindingIds, userId || session.user.id);
  return { success: true, count: bindingIds.length };
}

/**
 * 和解（检测并修复不一致）
 */
export async function reconcileBindings(canvasId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const result = await existenceEngine.reconcile(canvasId, true);
  return {
    success: true,
    autoFixed: result.autoFixed,
    requiresReview: result.requiresHumanReview,
    inconsistencies: result.inconsistencies
  };
}

/**
 * 人类批准待审核绑定
 */
export async function approveBinding(bindingId: string, userId: string) {
  await existenceEngine.approve(bindingId, userId);
  return { success: true };
}

/**
 * 人类拒绝待审核绑定
 */
export async function rejectBinding(bindingId: string, userId: string, reason: string) {
  await existenceEngine.reject(bindingId, userId, reason);
  return { success: true };
}
```

#### 标记为废弃

```typescript
/**
 * @deprecated Use existenceEngine.hideByElementIds() instead
 */
export async function deleteBindingsByElementIds(...) {
  console.warn('[DEPRECATED] Use ExistenceEngine API');
  // 保留向后兼容，但内部调用新 API
  return hideBindings(bindingIds);
}
```

---

### 阶段6: 人类裁决 UI（2-3小时，可选）

**新文件**: `/Users/aki5695/code/20260110_jotion/components/binding-arbitration-panel.tsx`

```typescript
/**
 * 人类裁决面板
 * 显示所有 status='pending' 的绑定，允许批准/拒绝
 */
export function BindingArbitrationPanel({ canvasId }: { canvasId: string }) {
  const [pendingBindings, setPendingBindings] = useState([]);

  useEffect(() => {
    // 加载 pending 绑定
    const loadPending = async () => {
      const bindings = await existenceEngine.getBindingsByStatus('pending');
      setPendingBindings(bindings);
    };
    loadPending();
  }, [canvasId]);

  const handleApprove = async (bindingId: string) => {
    await approveBinding(bindingId, userId);
    // 刷新列表
  };

  const handleReject = async (bindingId: string, reason: string) => {
    await rejectBinding(bindingId, userId, reason);
    // 刷新列表
  };

  return (
    <div className="arbitration-panel">
      <h3>⚖️ Pending Bindings ({pendingBindings.length})</h3>
      {pendingBindings.map(binding => (
        <div key={binding.id} className="binding-card">
          <span>{binding.anchorText}</span>
          <button onClick={() => handleApprove(binding.id)}>✓ Approve</button>
          <button onClick={() => handleReject(binding.id, 'User rejected')}>✗ Reject</button>
        </div>
      ))}
    </div>
  );
}
```

---

## 测试验证

### 测试场景

#### 场景1: Canvas 删除 → Document 隐藏
```
1. 拖拽文本到 Canvas 创建绑定
2. 在 Canvas 中删除元素（Del键）
3. 验证：Document 中标记变为删除线（.is-deleted）
4. 验证：数据库 binding.current_status = 'hidden'
5. 验证：Console 输出 '[Canvas] Hid 1 bindings via ExistenceEngine'
```

#### 场景2: Undo 恢复
```
1. 删除 Canvas 元素
2. 按 Ctrl+Z 恢复
3. 验证：Document 中标记恢复正常样式
4. 验证：数据库 binding.current_status = 'visible'
5. 验证：Console 输出 '[Canvas] Restored element: xxx'
```

#### 场景3: 页面刷新无幽灵
```
1. 删除 Canvas 元素
2. 刷新页面（F5）
3. 验证：Document 标记仍然是删除线
4. 验证：不会重新出现正常标记
5. 验证：Console 输出 'Auto-fixed X inconsistencies'（如果有）
```

#### 场景4: 和解修复
```
1. 手动在数据库中制造不一致（binding visible 但 element deleted）
2. 刷新页面或调用 reconcileBindings()
3. 验证：系统自动修复，设置 binding status='hidden'
4. 验证：Toast 提示 'Auto-fixed X inconsistencies'
```

#### 场景5: 人类裁决
```
1. 创建 pending 状态的绑定
2. 打开裁决面板
3. 点击 Approve
4. 验证：binding status='visible'，标记正常显示
5. 验证：数据库有 binding_status_log 记录
```

### 性能测试

```typescript
// 测试 O(1) 查询性能
console.time('getStatus');
for (let i = 0; i < 10000; i++) {
  existenceEngine.getStatus(randomBindingId);
}
console.timeEnd('getStatus'); // 应该 <10ms

// 测试批量操作
console.time('hideMany');
await existenceEngine.hideMany(array1000BindingIds);
console.timeEnd('hideMany'); // 应该 <500ms
```

---

## 关键文件清单

### 新建文件
1. `/lib/existence-engine.ts` - 核心引擎（600行）
2. `/lib/existence-event-bus.ts` - 事件系统（200行）
3. `/components/binding-arbitration-panel.tsx` - UI面板（可选，200行）

### 修改文件
1. `/db/canvas-schema.ts` - 新增3张表 + 修改现有表
2. `/actions/canvas-bindings.ts` - 新增5个 action，标记1个废弃
3. `/components/excalidraw-canvas.tsx` - 3处修改（删除检测、初始化、恢复监听）
4. `/components/editor.tsx` - 1处替换（事件监听）
5. `/app/globals.css` - 新增 CSS 样式

### 数据库迁移
1. `migrations/xxx-add-existence-engine.sql` - 完整 SQL 脚本

---

## 实施顺序

1. **第一天上午**: 数据库架构 + 迁移脚本
2. **第一天下午**: ExistenceEngine 核心实现
3. **第二天上午**: Canvas + Editor 集成
4. **第二天下午**: Server Actions + 测试验证
5. **第三天**（可选）: 人类裁决 UI + 性能优化

---

## 默认配置决策

基于最佳实践，采用以下默认配置：

### 1. 数据迁移策略
**选择**: 全部迁移（回填 current_status）
- 理由：保留历史数据完整性，避免新旧系统混合
- 实施：运行迁移脚本回填所有现有绑定的状态

### 2. 人类裁决触发
**选择**: 和解检测到不一致时 pending（置信度<0.9）
- 理由：渐进式实施，先解决核心问题，AI裁决后续添加
- 实施：reconcile() 检测到低置信度不一致时设置 status='pending'

### 3. 和解运行时机
**选择**: 页面加载时自动运行 + 手动触发
- 理由：自动修复常见问题，同时提供手动修复入口
- 实施：Canvas初始化时调用 reconcile()，toast提示修复结果

### 4. 缓存策略
**选择**: 按 Canvas 分片加载
- 理由：适合各种规模，避免内存浪费
- 实施：initialize(canvasId) 仅加载当前Canvas的绑定

---

## 风险与缓解

### 风险1: 数据迁移失败
**缓解**:
- 先在开发环境测试
- 创建数据库备份
- 提供回滚脚本

### 风险2: 事件丢失
**缓解**:
- ExistenceEventBus 持久化到 localStorage
- 页面加载时恢复队列
- 最多重试3次

### 风险3: 性能下降
**缓解**:
- 内存索引保证 O(1)
- 批量操作合并
- 按Canvas分片加载

### 风险4: 与现有代码冲突
**缓解**:
- 保留旧 API（标记 deprecated）
- 渐进式迁移
- 完整测试覆盖

---

## 成功标准

✅ 删除 Canvas 元素后，Document 标记立即变为删除线
✅ Undo 恢复后，标记恢复正常样式
✅ 页面刷新后，无幽灵绑定出现
✅ 和解功能自动修复不一致
✅ 所有操作可审计（binding_status_log）
✅ 性能：getStatus < 1ms, hideMany(1000) < 500ms
✅ 零数据丢失（持久化事件队列）

---

## 后续优化（未来）

1. **WebSocket 实时同步**: 多用户协作时的状态同步
2. **CRDT 冲突解决**: 处理并发编辑冲突
3. **GraphQL 订阅**: 实时状态推送
4. **机器学习仲裁**: AI 自动审核 pending 绑定
5. **分布式锁**: 防止并发状态冲突

---

**预计总工时**: 12-15小时
**核心优势**: 单一真相源 + 事件驱动 + O(1)性能 + 完整审计
