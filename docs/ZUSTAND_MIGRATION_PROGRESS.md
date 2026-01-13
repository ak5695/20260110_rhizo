# Zustand 状态管理优化进度

> 将分散的 useState + window.dispatchEvent 模式迁移至 Zustand 全局状态管理

## ✅ 已完成

### 1. 文档元数据 Store (`useDocumentStore`)
**完成日期**: 2026-01-12

**功能**:
- 标题实时同步（输入时三处同时更新）
- 图标实时同步
- 防抖自动保存到后端
- 防止 SWR 刷新时的闪烁问题

**文件**: `store/use-document-store.ts`

**使用组件**:
- `components/toolbar.tsx`
- `components/main/title.tsx`
- `components/main/document-list.tsx`

---

### 2. 侧边栏状态 Store (`useSidebarStore`)
**完成日期**: 2026-01-12

**功能**:
- 统一侧边栏状态管理（折叠/展开/宽度）
- 消除 `window.dispatchEvent("jotion-sidebar-change")` 模式
- 消除 `window.addEventListener` 事件监听
- 自动处理移动端适配

**文件**: `store/use-sidebar-store.ts`

**使用组件**:
- `components/main/navigation.tsx` - 主控制
- `components/main/navbar.tsx` - 响应状态

**移除的代码**:
- `window.dispatchEvent(new CustomEvent("jotion-sidebar-change", ...))`
- `window.addEventListener("jotion-sidebar-change", ...)`
- `window.dispatchEvent(new Event("jotion-reset-sidebar"))`

---

### 3. 布局状态 Store (`useLayoutStore`)
**完成日期**: 2026-01-12

**功能**:
- Canvas 可见性控制（开/关）
- Canvas 全屏模式
- 文档大纲可见性
- 消除 props drilling

**文件**: `store/use-layout-store.ts`

**使用组件**:
- `app/(main)/(routes)/documents/[documentId]/page.tsx`
- `components/main/navbar.tsx` - 控制按钮
- `components/selection-toolbar.tsx` - 自动展开 Canvas

**移除的代码**:
- `useState` for `isCanvasOpen`, `isCanvasFullscreen`, `isOutlineOpen`
- `useCallback` for `toggleCanvas`, `toggleCanvasFullscreen`
- Props drilling through Navbar

---

### 4. 双向联动导航 Store (`useNavigationStore`)
**完成日期**: 2026-01-12

**功能**:
- 管理 Canvas ↔ Document 双向导航
- 消除 `window.dispatchEvent("document:jump-to-block")` 事件
- 消除 `window.dispatchEvent("canvas:jump-to-element")` 事件
- 自动高亮目标元素/块（2秒后清除）
- 类型安全的导航命令

**文件**: `store/use-navigation-store.ts`

**使用组件**:
- `components/excalidraw-canvas.tsx` - 监听 element target，触发 block jump
- `components/editor.tsx` - 监听 block target，触发 element jump

**移除的代码**:
- `window.dispatchEvent(new CustomEvent("document:jump-to-block", ...))`
- `window.dispatchEvent(new CustomEvent("canvas:jump-to-element", ...))`
- `window.addEventListener("document:jump-to-block", ...)`
- `window.addEventListener("canvas:jump-to-element", ...)`

---

### 5. 拖拽状态 Store (`useDragStore`)
**完成日期**: 2026-01-12

**功能**:
- 管理全局拖拽状态
- 统一拖拽 payload 类型
- 支持拖拽目标追踪（用于悬停效果）
- 任何组件都可以感知当前拖拽状态

**文件**: `store/use-drag-store.ts`

**可用于**:
- `components/selection-toolbar.tsx` - 拖拽到画布
- `components/excalidraw-canvas.tsx` - 接收拖放
- 未来的拖拽预览/覆盖层

---

## 📊 迁移统计

| 指标 | 迁移前 | 迁移后 |
|------|--------|--------|
| window 事件类型 | 6+ | 1 (documents-changed) |
| 跨组件 props drilling | 多处 | 0 |
| 事件监听器 | 15+ | 5 |
| 状态管理模式 | 混合 | 统一 Zustand |

---

## 迁移原则

1. **只初始化一次**: `setXxx` 方法检查是否已存在，防止覆盖用户编辑
2. **乐观更新**: UI 立即响应，后台异步保存
3. **选择性订阅**: 使用 selector 函数避免不必要的重渲染
4. **错误回滚**: 保存失败时恢复之前状态
5. **自动清理**: 导航目标自动清除，高亮自动消失

