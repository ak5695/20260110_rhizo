# 文档-画布双向绑定引擎 - 企业级设计

## 核心问题分析

### 当前问题
1. ❌ 拖拽后弹出selection-toolbar（重复UI）
2. ❌ 删除画布元素，文档标记变灰色而非消失
3. ❌ 刷新后幽灵绑定重新出现
4. ❌ 删除链接，文档标记未消失

### 根本原因
- **状态不同步**：Canvas元素isDeleted与绑定表脱节
- **多真相来源**：既有DB状态，又有Canvas实时状态，冲突时无明确优先级
- **清理不彻底**：删除操作未级联清理所有关联状态

---

## 新架构设计原则

### 1. 单一数据源（Single Source of Truth）
**Canvas状态 > 数据库状态**
- Canvas中的`isDeleted`是唯一真相
- 数据库仅用于持久化，不参与运行时判断

### 2. 立即传播（Immediate Propagation）
删除操作立即触发：
1. Canvas元素标记为deleted
2. 发送事件通知Editor
3. 数据库清理绑定记录
4. UI移除所有视觉标记

### 3. 零幽灵绑定（Zero Ghost Bindings）
- **主动清理**：页面加载时调用`cleanupOrphanedBindings()`
- **事件驱动**：删除元素立即清理，不等刷新
- **防御性查询**：`getCanvasBindings()`过滤`isDeleted=true`

---

## 数据流设计

### 创建绑定流程
```
用户拖拽文本到Canvas
  ↓
handleDrop() - ExcalidrawCanvas
  ↓
创建Excalidraw元素 (isDeleted: false)
  ↓
createCanvasBinding() - 数据库INSERT
  ↓
bindingService.addBinding() - 内存更新
  ↓
事件：binding:created
  ↓
Editor监听 → 显示绑定标记
```

### 删除元素流程（核心改进）
```
用户在Canvas中删除元素
  ↓
Excalidraw onChange - elements包含isDeleted=true
  ↓
检测已删除元素ID列表
  ↓
并行执行：
  ├─ deleteBindingsByElementIds() - 数据库DELETE
  ├─ bindingService.deleteBinding() - 内存清理
  └─ 事件：binding:element-deleted
       ↓
       Editor监听 → 立即移除UI标记（不是变灰，是彻底移除）
```

### 刷新页面流程
```
页面加载
  ↓
getCanvasBindings() - 查询bindings（LEFT JOIN检测isDeleted）
  ↓
cleanupOrphanedBindings() - 清理幽灵绑定
  ↓
bindingService.initialize(activeBindings)
  ↓
仅渲染isElementDeleted=false的绑定
```

---

## 实现清单

### ExcalidrawCanvas
- [x] 添加删除检测逻辑
- [ ] onChange时对比prev/curr elements，提取新删除的ID
- [ ] 调用deleteBindingsByElementIds()清理数据库
- [ ] 触发binding:element-deleted事件
- [ ] 不再发送canvas:element-status-update（废弃）

### Editor
- [x] 集成bindingService
- [ ] 监听binding:created → 添加标记
- [ ] 监听binding:element-deleted → **移除标记**（不是变灰）
- [ ] 移除is-deleted CSS样式系统
- [ ] 移除deletedElementIds状态管理
- [ ] 移除EditorBindingOverlay幽灵检测逻辑

### SelectionToolbar
- [ ] 拖拽成功后不弹出菜单
- [ ] 监听document:canvas-binding-success事件
- [ ] 收到事件后自动隐藏Toolbar

### BindingService
- [x] 单例服务
- [x] 内存索引：bindings, elementToBinding, blockToBindings
- [x] 事件系统：CREATED, DELETED, ELEMENT_DELETED
- [ ] 与Canvas onChange集成

---

## API对比

### 旧方案（问题方案）
```typescript
// 多真相来源
const isGhost = hasLiveInfo
  ? deletedElementIds.has(elementId)  // Canvas实时状态
  : binding.isElementDeleted;          // DB状态

// 样式灰化
el.classList.add('is-deleted'); // 仍然显示，但变灰

// 删除未清理
// Canvas删除元素，但绑定记录仍在数据库
```

### 新方案（企业级方案）
```typescript
// 单一真相来源
const bindings = bindingService.getActiveBindings(); // 仅返回未删除的

// 彻底移除
bindingService.deleteBinding(bindingId); // 从内存+DB彻底删除

// 立即清理
useEffect(() => {
  const cleanup = useBindingEvents(
    onCreate,
    onDelete,
    (elementIds) => {
      // 立即移除UI标记，不保留任何痕迹
      elementIds.forEach(id => {
        const marker = document.querySelector(`[data-element-id="${id}"]`);
        marker?.remove();
      });
    }
  );
  return cleanup;
}, []);
```

---

## 性能优化

### 批量操作
- 删除100个元素时，一次性调用`deleteBindingsByElementIds(ids[])`
- 避免100次单独DELETE查询

### 防抖
- Canvas onChange已有800ms防抖
- 删除检测复用此防抖，避免额外延迟

### 增量更新
- onChange时仅对比变化的元素
- 使用Set.difference计算新删除的ID

---

## 测试场景

### 场景1：拖拽绑定
- [ ] 拖拽文本到Canvas
- [ ] 绑定创建成功
- [ ] 文档显示标记
- [ ] **不弹出SelectionToolbar**

### 场景2：删除元素
- [ ] 在Canvas删除绑定元素
- [ ] 文档标记**立即消失**（不变灰）
- [ ] 数据库绑定记录被DELETE
- [ ] bindingService内存清理

### 场景3：刷新页面
- [ ] 刷新页面
- [ ] cleanupOrphanedBindings()执行
- [ ] **无幽灵绑定显示**
- [ ] 仅显示有效绑定

### 场景4：删除链接（解绑）
- [ ] 在Canvas中选中元素，清空link属性
- [ ] 数据库绑定DELETE
- [ ] 文档标记消失
- [ ] 元素仍保留在Canvas

---

## 核心代码片段

### ExcalidrawCanvas - 删除检测
```typescript
const prevElementsRef = useRef<Set<string>>(new Set());

const handleCanvasChange = useCallback(async (elements, appState) => {
  const currentIds = new Set(elements.filter(el => !el.isDeleted).map(el => el.id));
  const prevIds = prevElementsRef.current;

  // 计算新删除的元素
  const deletedIds = Array.from(prevIds).filter(id => !currentIds.has(id));

  if (deletedIds.length > 0 && canvasId) {
    // 立即清理数据库
    const result = await deleteBindingsByElementIds(canvasId, deletedIds);

    if (result.success) {
      // 通知Editor
      window.dispatchEvent(new CustomEvent('binding:element-deleted', {
        detail: { elementIds: deletedIds }
      }));
    }
  }

  prevElementsRef.current = currentIds;
}, [canvasId]);
```

### Editor - 绑定事件监听
```typescript
useEffect(() => {
  const handleElementDeleted = (e: CustomEvent) => {
    const { elementIds } = e.detail;

    // 彻底移除绑定标记
    elementIds.forEach(elementId => {
      const markers = document.querySelectorAll(`[data-element-id="${elementId}"]`);
      markers.forEach(marker => marker.remove());
    });

    // 从bindingService清理
    elementIds.forEach(elementId => {
      const binding = bindingService.getBindingByElementId(elementId);
      if (binding) {
        bindingService.deleteBinding(binding.id);
      }
    });
  };

  window.addEventListener('binding:element-deleted', handleElementDeleted);
  return () => window.removeEventListener('binding:element-deleted', handleElementDeleted);
}, []);
```

---

## 成功标准

✅ 拖拽后不弹出菜单
✅ 删除元素，标记立即消失（不变灰）
✅ 刷新后无幽灵绑定
✅ 删除链接，标记立即消失
✅ 性能优化：批量操作、防抖、增量更新
✅ 企业级：单一数据源、立即传播、零幽灵绑定
