# 删除检测调试指南

## 🔍 问题分析

你提出了一个关键问题：**Excalidraw 删除元素后，是否真的触发了 EAS 的隐藏操作？**

## 📊 删除检测机制

### 当前实现 (excalidraw-canvas.tsx:363-392)

```typescript
const detectAndCleanupDeletedBindings = useCallback(
    debounce(async (canvasId: string, currentElements: readonly any[]) => {
        // 1. 获取当前活跃元素（未删除的）
        const currentActiveIds = new Set(
            currentElements.filter(el => !el.isDeleted).map(el => el.id)
        );

        // 2. 对比前后状态
        const prevActiveIds = prevActiveElementsRef.current;
        const newlyDeletedIds = Array.from(prevActiveIds).filter(
            id => !currentActiveIds.has(id)
        );

        // 3. 如果有新删除的元素，调用 EAS
        if (newlyDeletedIds.length > 0) {
            console.log('[Canvas] Detected deleted elements:', newlyDeletedIds);

            const { hideBindingsByElementIds } = await import('@/actions/canvas');
            const result = await hideBindingsByElementIds(canvasId, newlyDeletedIds);

            if (result.success && result.hiddenCount > 0) {
                console.log('[Canvas] Hid', result.hiddenCount, 'bindings via ExistenceEngine');
                window.dispatchEvent(new Event('refresh-bindings'));
            }
        }

        prevActiveElementsRef.current = currentActiveIds;
    }, 500),
    []
);
```

### 调用位置 (excalidraw-canvas.tsx:406)

```typescript
const handleCanvasChange = (elements: readonly any[], appState: any) => {
    if (!isLoaded || !canvasId) return;

    // 每次 Canvas 变化都会触发
    detectAndCleanupDeletedBindings(canvasId, elements);

    // ... 其他逻辑
};
```

## 🧪 调试步骤

### 1. 监控删除检测

在浏览器 Console 中运行：

```javascript
// 监听所有 Canvas 变化
let changeCount = 0;
const originalLog = console.log;
console.log = function(...args) {
    if (args[0] && args[0].includes('[Canvas]')) {
        originalLog.apply(console, ['🔍 DEBUG:', ...args]);
    } else {
        originalLog.apply(console, args);
    }
};

// 计数器
window.__debugDeleteCount__ = 0;
window.addEventListener('refresh-bindings', () => {
    window.__debugDeleteCount__++;
    console.log('🎯 Delete event triggered:', window.__debugDeleteCount__);
});
```

### 2. 手动测试删除

1. **拖拽文本到 Canvas** - 创建一个绑定
2. **选中该元素，按 Del 键删除**
3. **观察 Console 输出**

### 预期输出

如果删除检测正常工作，应该看到：

```
🔍 DEBUG: [Canvas] Detected deleted elements: ["element-id-xxx"]
🔍 DEBUG: [Canvas] Hid 1 bindings via ExistenceEngine
🎯 Delete event triggered: 1
```

## 🐛 可能的问题

### 问题1: `isDeleted` 标记延迟

**症状**: Excalidraw 可能不会立即设置 `isDeleted=true`，而是直接从数组中移除元素。

**验证**:
```javascript
// 监听 Canvas 元素变化
window.__lastElements__ = [];
window.__monitorElements__ = (elements) => {
    console.log('📊 Elements count:', elements.length);
    console.log('📊 Deleted elements:', elements.filter(el => el.isDeleted).length);
    window.__lastElements__ = elements;
};

// 在 handleCanvasChange 中调用 window.__monitorElements__(elements)
```

### 问题2: 防抖延迟太长

**症状**: 500ms 的防抖可能导致用户感觉响应慢。

**解决**: 减少防抖时间或使用 throttle
```typescript
debounce(async (canvasId, currentElements) => { ... }, 200) // 改为 200ms
```

### 问题3: prevActiveElementsRef 未初始化

**症状**: 第一次删除时，`prevActiveElementsRef.current` 是空的，无法检测到删除。

**验证**:
```javascript
// 检查初始化状态
console.log('Previous active IDs:', Array.from(prevActiveElementsRef.current));
```

### 问题4: EAS 事件未触发到 Editor

**症状**: EAS 成功隐藏了绑定，但 Editor 没有监听到 `binding:hidden` 事件。

**验证**:
```javascript
// 监听 binding:hidden 事件
window.addEventListener('binding:hidden', (e) => {
    console.log('✅ Editor received binding:hidden:', e.detail);
});
```

## 🔧 临时调试补丁

在 `excalidraw-canvas.tsx` 的 `detectAndCleanupDeletedBindings` 函数开头添加：

```typescript
console.log('[DEBUG] detectAndCleanupDeletedBindings called');
console.log('[DEBUG] Current elements count:', currentElements.length);
console.log('[DEBUG] Previous active count:', prevActiveIds.size);
console.log('[DEBUG] Current active count:', currentActiveIds.size);
console.log('[DEBUG] Newly deleted count:', newlyDeletedIds.length);
```

## 📋 测试清单

- [ ] 拖拽文本到 Canvas 成功
- [ ] 删除 Canvas 元素触发 `[Canvas] Detected deleted elements`
- [ ] EAS 成功隐藏绑定 `[Canvas] Hid X bindings`
- [ ] Editor 接收到 `binding:hidden` 事件
- [ ] Document 中的标记变为删除线

## 🎯 预期 Console 输出（完整流程）

```
// 1. 初始化
[Canvas] ExistenceEngine initialized
[Canvas] Reconciliation: { autoFixed: 0, requiresHumanReview: 0 }

// 2. 拖拽创建绑定
[ExcalidrawCanvas] Drop payload: {...}
[CreateBinding] Created binding: {...}
[Editor] Loaded bindings: [...]

// 3. 删除元素
[DEBUG] detectAndCleanupDeletedBindings called
[DEBUG] Newly deleted count: 1
[Canvas] Detected deleted elements: ["abc123"]
[Canvas] Hid 1 bindings via ExistenceEngine
[ExistenceEngine] Transition: binding-id-xxx visible -> hidden
[ExistenceEngine] Emitted event: hidden {...}

// 4. Editor 响应
[Editor] Binding hidden: binding-id-xxx abc123
[Editor] Applied ghosting to element: abc123
```

## 💡 建议

1. **添加详细日志** - 在每个关键步骤添加 console.log
2. **监控元素状态** - 确认 Excalidraw 真的设置了 `isDeleted`
3. **测试事件流** - 验证整个事件链路：Canvas → EAS → Editor
4. **检查防抖时间** - 可能需要调整为更短的延迟

---

**测试人**: _________
**日期**: _________
**结果**: _________
**问题**: _________
