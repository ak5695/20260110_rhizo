# EAS 测试指南 - Existence Arbitration System

## 🎯 测试目标

验证 EAS 的 5 个核心功能场景，确保系统按照设计规范运行。

---

## 📝 测试前准备

### 1. 启动开发服务器
```bash
npm run dev
# ✅ 服务器已启动: http://localhost:3000
```

### 2. 打开浏览器开发工具
- 按 F12 打开 DevTools
- 切换到 Console 标签，观察日志输出
- 切换到 Network 标签，观察网络请求

### 3. 创建测试文档
1. 登录系统
2. 创建一个新文档（用于测试）
3. 在文档中输入一些测试文本

---

## ✅ 测试场景 1: Canvas删除 → Document隐藏

### 操作步骤
1. 在 Document 中选中一段文本（例如 "测试文本1"）
2. 拖拽文本到 Canvas 画布上
3. 验证文本出现在 Canvas 上，Document 中文本有蓝色下划线标记
4. 在 Canvas 中选中该元素，按 `Del` 键删除

### 预期结果
✅ **Document 中的标记立即变为删除线样式**
- 文本有删除线 (line-through)
- 不透明度降低到 0.4
- 文本颜色变灰

✅ **Console 输出**
```
[Canvas] Detected deleted elements: ["element-id-xxx"]
[Canvas] Hid 1 bindings via ExistenceEngine
[ExistenceEngine] Transition: binding-id-xxx visible -> hidden
[ExistenceEngine] Emitted event: hidden {...}
[Editor] Binding hidden: binding-id-xxx element-id-xxx
[Editor] Applied ghosting to element: element-id-xxx
```

✅ **Database 验证**
- `document_canvas_bindings.currentStatus` = `'hidden'`
- `binding_status_log` 有新记录，`status='hidden'`, `transitionType='user_hide'`

### 如何检查
- 观察 Document 中的文本样式变化
- 打开 Console，确认日志输出
- 检查 CSS 类：右键点击文本 → 检查元素 → 应该有 `is-deleted` 类

---

## ✅ 测试场景 2: Undo恢复

### 操作步骤
1. 继续上一个测试场景
2. 在 Canvas 中按 `Ctrl+Z` (Windows) 或 `Cmd+Z` (Mac) 撤销删除

### 预期结果
✅ **Canvas 元素恢复显示**
- 被删除的元素重新出现在 Canvas 上

✅ **Document 标记恢复正常**
- 删除线消失
- 不透明度恢复到 1.0
- 文本颜色恢复正常蓝色

✅ **Console 输出**
```
[Canvas] Binding shown (restore): binding-id-xxx element-id-xxx
[Canvas] Restored element: element-id-xxx
[ExistenceEngine] Transition: binding-id-xxx hidden -> visible
[ExistenceEngine] Emitted event: shown {...}
[Editor] Binding shown (restore): binding-id-xxx element-id-xxx
[Editor] Removed ghosting from element: element-id-xxx
```

✅ **Database 验证**
- `document_canvas_bindings.currentStatus` = `'visible'`
- `binding_status_log` 有新记录，`status='visible'`, `transitionType='user_show'`

---

## ✅ 测试场景 3: 页面刷新无幽灵绑定

### 操作步骤
1. 删除 Canvas 元素（参考场景1）
2. 等待删除线样式出现
3. 按 `F5` 刷新页面
4. 等待页面加载完成

### 预期结果
✅ **Document 标记保持删除线样式**
- 刷新后，文本仍然是删除线
- 没有短暂恢复正常的闪烁

✅ **Console 输出**
```
[Canvas] ExistenceEngine initialized
[Canvas] Reconciliation: { autoFixed: 0, requiresHumanReview: 0, ... }
[Editor] Binding hidden: binding-id-xxx element-id-xxx (如果状态未同步)
```

✅ **不会出现幽灵绑定**
- 页面刷新后不会看到正常的蓝色下划线短暂出现

### 关键验证
- 这是测试 **事件持久化** 的关键场景
- 如果出现幽灵绑定，说明 ExistenceEventBus 未正确工作
- 检查 localStorage: 打开 DevTools → Application → Local Storage → 查看 `existence-event-queue`

---

## ✅ 测试场景 4: 和解修复不一致

### 操作步骤（制造不一致）
1. 停止开发服务器
2. 使用数据库工具（Drizzle Studio 或 SQL）手动修改数据：
   ```sql
   -- 制造不一致：Canvas元素已删除，但绑定状态仍为visible
   UPDATE document_canvas_bindings
   SET current_status = 'visible'
   WHERE id = 'your-binding-id';

   -- 对应的Canvas元素设为删除
   UPDATE canvas_elements
   SET is_deleted = true
   WHERE id = 'your-element-id';
   ```
3. 重启开发服务器
4. 刷新页面

### 预期结果
✅ **自动修复不一致**
```
[Canvas] ExistenceEngine initialized
[ExistenceEngine] Reconciling canvas: canvas-id-xxx autoFix: true
[ExistenceEngine] Detected 1 inconsistencies
[ExistenceEngine] Auto-fix: element deleted
[ExistenceEngine] Transition: binding-id-xxx visible -> hidden
[Canvas] Reconciliation: { autoFixed: 1, requiresHumanReview: 0, ... }
```

✅ **Toast 提示**
- 显示: "Auto-fixed 1 inconsistencies"

✅ **Database 验证**
- `binding_inconsistencies` 表有新记录
- `binding_status_log` 有 `transitionType='system_reconcile'` 记录
- `document_canvas_bindings.currentStatus` = `'hidden'`

---

## ✅ 测试场景 5: 人类裁决（可选）

### 操作步骤（制造低置信度不一致）
1. 使用数据库工具创建 `pending` 状态的绑定：
   ```sql
   UPDATE document_canvas_bindings
   SET current_status = 'pending'
   WHERE id = 'your-binding-id';
   ```
2. 刷新页面
3. 在 Console 中手动调用批准/拒绝：
   ```javascript
   // 批准绑定
   const { approveBinding } = await import('/actions/canvas');
   await approveBinding('binding-id-xxx', 'user-id-xxx');

   // 或拒绝绑定
   const { rejectBinding } = await import('/actions/canvas');
   await rejectBinding('binding-id-xxx', 'user-id-xxx', 'User rejected');
   ```

### 预期结果
✅ **Pending 状态样式**
- 文本有渐变色（黄色到橙色）
- 有脉动动画
- 前面有 ⚖️ 图标

✅ **批准后**
```
[ExistenceEngine] Approving binding: binding-id-xxx by user: user-id-xxx
[ExistenceEngine] Transition: binding-id-xxx pending -> visible
window event: binding:approved
```

✅ **拒绝后**
```
[ExistenceEngine] Rejecting binding: binding-id-xxx by user: user-id-xxx
[ExistenceEngine] Transition: binding-id-xxx pending -> deleted
window event: binding:rejected
```

---

## 🔍 性能测试

### 测试 O(1) 查询性能
在 Console 中运行：
```javascript
const { existenceEngine } = await import('/lib/existence-engine');

// 测试单次查询
console.time('getStatus');
existenceEngine.getStatus('binding-id-xxx');
console.timeEnd('getStatus'); // 应该 <1ms

// 测试10000次查询
console.time('getStatus-10000');
for (let i = 0; i < 10000; i++) {
  existenceEngine.getStatus('binding-id-xxx');
}
console.timeEnd('getStatus-10000'); // 应该 <10ms
```

### 预期结果
✅ 单次查询 `<1ms`
✅ 10000次查询 `<10ms`

---

## 🐛 常见问题排查

### 问题1: 删除后 Document 标记没有变删除线
**排查**:
1. 检查 Console 是否有错误
2. 检查是否正确导入 `existenceEngine`
3. 检查 CSS 类 `.is-deleted` 是否正确加载
4. 运行: `document.querySelector('.canvas-bound-text')` 查看元素

**解决**:
```javascript
// 手动检查
const { existenceEngine } = await import('/lib/existence-engine');
const status = existenceEngine.getEngineStatus();
console.log(status); // 应该显示 initialized: true
```

### 问题2: 页面刷新后出现幽灵绑定
**排查**:
1. 检查 localStorage 中的事件队列
2. 检查 `ExistenceEventBus` 是否正确初始化
3. 检查 Console 是否有 `[ExistenceEventBus]` 日志

**解决**:
```javascript
// 检查事件队列
const { existenceEventBus } = await import('/lib/existence-event-bus');
console.log(existenceEventBus.getQueueStatus());
```

### 问题3: Undo 后标记没有恢复
**排查**:
1. 检查 Canvas 是否触发了 `binding:shown` 事件
2. 检查 Editor 的事件监听器是否正确绑定
3. 检查 Console 日志

**解决**:
```javascript
// 手动测试事件
window.dispatchEvent(new CustomEvent('binding:shown', {
  detail: {
    bindingId: 'test-id',
    elementId: 'test-element-id',
    status: 'visible'
  }
}));
```

---

## 📊 成功标准

所有测试场景必须通过：
- ✅ 场景1: Canvas删除 → Document隐藏 (<300ms)
- ✅ 场景2: Undo恢复 → 标记恢复正常
- ✅ 场景3: 页面刷新 → 无幽灵绑定
- ✅ 场景4: 和解修复 → 自动修复不一致
- ✅ 场景5: 人类裁决 → 批准/拒绝成功

性能要求：
- ✅ `getStatus()` < 1ms
- ✅ `hideMany(1000)` < 500ms
- ✅ 内存占用 < 50MB (10K bindings)

---

## 🎉 测试完成

如果所有场景都通过，说明 EAS 实现成功！

### 下一步
1. ✅ 提交测试报告
2. ⏳ （可选）实现人类裁决 UI
3. ⏳ （可选）性能优化
4. ⏳ 生产环境部署

---

**测试时间**: _________
**测试人**: _________
**测试结果**: ✅ 通过 / ❌ 未通过
**备注**: _________
