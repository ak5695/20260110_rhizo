# Existence Arbitration System (EAS) - AI Assistant Guide

## 🎯 核心目标

实现一个**存在性仲裁引擎**，解决 Canvas-Document 绑定系统的三层状态不一致问题。

### 问题现状
```
❌ Canvas删除 → 硬删除绑定 → Editor手动移除样式
   - 事件丢失（刷新页面）
   - 状态不一致（幽灵绑定）
   - 无法恢复（硬删除）
```

### 解决方案
```
✅ BindingEntity.status 是唯一真相源
✅ Canvas节点和Document标记只是投影
✅ 事件驱动 + 持久化队列
✅ O(1)性能 + 完整审计
```

---

## 📋 完整实施计划

**详细文档**: `/EAS_IMPLEMENTATION_PLAN.md` (636行)

**关键内容**:
- 数据库Schema设计（3张新表）
- ExistenceEngine核心实现（600行）
- ExistenceEventBus事件系统（200行）
- Canvas + Editor 集成指南
- 测试验证场景

---

## ✅ 已完成工作

### 1. 数据库架构 (已提交: `2be1f85`)

**新增3张表**:
- `binding_status_log` - 状态变更审计
- `binding_inconsistencies` - 冲突检测
- `binding_existence_cache` - 性能缓存

**修改现有表**:
- `document_canvas_bindings` 添加:
  - `currentStatus`: 'visible' | 'hidden' | 'deleted' | 'pending'
  - `statusUpdatedAt`, `statusUpdatedBy`
  - 2个性能索引

**文件**: `db/canvas-schema.ts` (第211-355行)

---

## 🚧 待实施工作

### 阶段2: ExistenceEngine核心 (4-5小时)

**文件**: `/lib/existence-engine.ts` (需创建)

**核心功能**:
```typescript
class ExistenceEngine {
  // 幂等操作
  async hide(bindingId, actorId?): Promise<void>
  async show(bindingId, actorId?): Promise<void>
  async softDelete(bindingId, actorId?): Promise<void>
  async restore(bindingId, actorId?): Promise<void>

  // 批量操作
  async hideByElementIds(elementIds[]): Promise<number>

  // 查询 (O(1))
  getStatus(bindingId): Status
  getBindingByElementId(elementId): bindingId

  // 仲裁
  async reconcile(canvasId, autoFix): Promise<ReconcileResult>
}
```

**关键设计**:
- 内存索引 (Map<bindingId, Status>)
- 事务型状态转换 (transitionStatus)
- 双通道事件发射 (Node + Browser)

### 阶段3: Canvas集成 (1-2小时)

**文件**: `components/excalidraw-canvas.tsx`

**修改点**:
1. **删除检测** (第343-381行) - 替换为 `existenceEngine.hideByElementIds()`
2. **初始化** (第211-232行) - 添加 `existenceEngine.initialize()`
3. **恢复监听** (新增) - 监听 `binding:shown` 事件

### 阶段4: Editor集成 (1-2小时)

**文件**: `components/editor.tsx`

**修改点**:
1. **事件监听** (第712-774行) - 替换为 `binding:hidden/shown`
2. **CSS控制** - 使用 `.is-deleted` 类而非DOM操作

**CSS文件**: `app/globals.css`
```css
.canvas-bound-text.is-deleted {
  text-decoration: line-through;
  opacity: 0.4;
}
```

### 阶段5: Server Actions (1小时)

**文件**: `actions/canvas-bindings.ts`

**新增5个Actions**:
- `hideBindings(bindingIds[])`
- `showBindings(bindingIds[])`
- `reconcileBindings(canvasId)`
- `approveBinding(bindingId, userId)`
- `rejectBinding(bindingId, userId, reason)`

---

## 🎨 设计原则

### 必须遵守

❌ **禁止在UI层做状态同步**
❌ **禁止组件直接操作对方状态**
✅ **只修改 BindingEntity.status**
✅ **通过事件通知UI层**
✅ **保证 O(1) 操作复杂度**

### 哲学

> **对象不是被删除的，它们是被判定为不存在的。**

这不是UI逻辑，这是系统本体论。

---

## 📊 测试验证

### 5个核心场景

1. **Canvas删除 → Document隐藏**
   - 删除Canvas元素 → Document标记变删除线
   - 验证: `currentStatus = 'hidden'`

2. **Undo恢复**
   - Ctrl+Z恢复元素 → 标记恢复正常
   - 验证: `currentStatus = 'visible'`

3. **页面刷新无幽灵**
   - 删除后刷新 → 标记保持删除线
   - 验证: Toast显示 "Auto-fixed X inconsistencies"

4. **和解修复**
   - 制造不一致 → 调用reconcile()
   - 验证: 自动修复并记录日志

5. **人类裁决**
   - 创建pending绑定 → 批准/拒绝
   - 验证: 状态转换 + 审计日志

---

## ⚠️ 关键注意事项

### For AI Assistants

1. **严格遵循计划**: 按 `EAS_IMPLEMENTATION_PLAN.md` 执行
2. **不要创新**: 架构已设计好，不要自行修改
3. **保持事务**: 状态转换必须在transaction中
4. **双通道事件**: 同时触发 Node EventEmitter + window.dispatchEvent
5. **幂等操作**: 所有操作可重复调用

### 性能要求

- `getStatus()` < 1ms
- `hideMany(1000)` < 500ms
- 内存占用 < 50MB (10K bindings)

### 错误处理

- 事件失败 → 重试3次 → localStorage持久化
- 状态转换失败 → 回滚transaction
- 和解失败 → 记录到 `binding_inconsistencies`

---

## 📁 关键文件索引

### 已完成
- ✅ `db/canvas-schema.ts` (第211-355行) - Database schema
- ✅ `EAS_IMPLEMENTATION_PLAN.md` - 完整实施指南

### 待创建
- ⏳ `lib/existence-engine.ts` - 核心引擎 (600行)
- ⏳ `lib/existence-event-bus.ts` - 事件系统 (200行)

### 待修改
- ⏳ `components/excalidraw-canvas.tsx` - 3处修改
- ⏳ `components/editor.tsx` - 1处替换
- ⏳ `actions/canvas-bindings.ts` - 5个新action
- ⏳ `app/globals.css` - CSS样式

---

## 🚀 快速开始

### 1. 阅读完整计划
```bash
less EAS_IMPLEMENTATION_PLAN.md
```

### 2. 按顺序实施
```
阶段2 (4-5h) → 阶段3 (1-2h) → 阶段4 (1-2h) → 阶段5 (1h)
```

### 3. 运行测试
```bash
# 测试5个核心场景
npm run test:eas
```

---

## 📚 相关文档

- `EAS_IMPLEMENTATION_PLAN.md` - 完整实施计划 (636行)
- `BINDING_ENGINE_DESIGN.md` - 绑定引擎架构
- `PERFORMANCE_OPTIMIZATION.md` - 性能优化指南
- `PERFORMANCE_TEST.md` - 性能测试指南

---

## 🎯 成功标准

✅ 删除Canvas元素后，Document标记立即变删除线
✅ Undo恢复后，标记恢复正常样式
✅ 页面刷新后，无幽灵绑定出现
✅ 和解功能自动修复不一致
✅ 所有操作可审计 (binding_status_log)
✅ 性能: getStatus < 1ms, hideMany(1000) < 500ms
✅ 零数据丢失 (持久化事件队列)

---

**预计总工时**: 12-15小时
**当前进度**: 2-3小时 (Database Schema完成)
**剩余工作**: 10-12小时

---

**重要**: 严格按照 `EAS_IMPLEMENTATION_PLAN.md` 执行，不要偏离设计！
