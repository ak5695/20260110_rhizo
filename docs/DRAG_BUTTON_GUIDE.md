# 拖拽按钮使用指南 🎯

## 概述

全新的**拖拽按钮**交互方式让你可以轻松将编辑器中的文字拖拽到画布上，创建手绘风格的便签卡片。

## 使用方法

### 1. 选中文字
在编辑器中选中任意文字（至少 4 个字符）

### 2. 拖拽按钮出现
选中文字后，右侧会自动出现一个**橙红色的拖拽按钮**
- 按钮带有抓手图标 🖐️
- 鼠标悬停时会放大
- 有虚线连接到选中的文字

### 3. 拖拽到画布
- 点击并按住拖拽按钮
- 拖动到右侧画布区域
- 松开鼠标，完成拖拽

### 4. 自动创建元素
- 画布上会出现一个手绘风格的便签卡片
- 卡片包含你选中的文字
- 自动保存到数据库
- 建立文档-画布绑定关系

## 视觉效果

### 拖拽按钮样式
```
🖐️ ↔️  [橙红色渐变按钮]
```
- 圆角设计
- 白色边框
- 阴影效果
- 悬停放大动画

### 拖拽预览
拖拽时会显示一个预览卡片：
```
┌─────────────────────────┐
│ 📝 HEADING              │
│                         │
│ 你选中的文字内容...      │
│                         │
│ → Drag to Canvas        │
└─────────────────────────┘
```

不同类型有不同的颜色：
- **标题** - 琥珀色背景 (Amber)
- **段落** - 靛蓝色背景 (Indigo)
- **代码** - 深灰色背景 (Dark Gray)

## 技术实现

### 组件结构
```tsx
<Editor>
  <BlockNoteView />
  <DragButton
    documentId={documentId}
    containerSelector=".bn-container"
  />
</Editor>
```

### 核心特性

**自动检测源类型**
- 标题（Heading）→ 大字体、粗体
- 段落（Paragraph）→ 正常字体
- 代码（Code）→ 等宽字体、深色背景

**智能定位**
- 按钮跟随选区位置
- 自动计算最佳显示位置
- 延迟隐藏（200ms）

**拖拽数据传输**
- 自定义 MIME 类型
- 包含完整元数据
- 支持回退到纯文本

## 与旧方案的对比

| 特性 | 旧方案 (Shift+拖拽) | 新方案 (拖拽按钮) |
|------|-------------------|-----------------|
| 触发方式 | 按住 Shift 键 | 点击拖拽按钮 |
| 视觉提示 | 需要提示组件 | 按钮本身即提示 |
| 学习曲线 | 需要记住快捷键 | 直观可见 |
| 冲突风险 | 可能与其他快捷键冲突 | 无冲突 |
| 移动端支持 | 不支持 | 易于适配触摸 |

## 优势

✅ **更直观**
- 按钮可见，无需记忆快捷键
- 明确的视觉引导

✅ **无冲突**
- 不依赖键盘修饰键
- 不影响其他功能

✅ **易于发现**
- 选中文字即出现
- 橙红色醒目提示

✅ **手感好**
- 拖拽按钮而非文字本身
- 更精确的控制

✅ **扩展性强**
- 可以添加更多操作按钮
- 支持触摸屏设备

## 未来增强

### 计划中的功能

1. **长按菜单**
   - 长按按钮显示更多选项
   - 选择元素类型（便签、框图、连线等）

2. **多选拖拽**
   - 支持拖拽多个选区
   - 创建多个元素

3. **拖拽目标提示**
   - 画布区域高亮
   - 显示预期位置

4. **自定义样式**
   - 选择卡片颜色
   - 选择图标

5. **触摸支持**
   - 适配移动端触摸操作
   - 长按拖拽

## 代码示例

### 使用 DragButton

```tsx
import { DragButton } from "@/components/drag-button";

function MyEditor({ documentId }) {
  return (
    <div className="editor-container">
      {/* 你的编辑器 */}
      <BlockNoteView />

      {/* 添加拖拽按钮 */}
      <DragButton
        documentId={documentId}
        containerSelector=".bn-container"
      />
    </div>
  );
}
```

### 自定义样式

可以通过 CSS 变量自定义按钮样式：

```css
/* 修改按钮颜色 */
.drag-button {
  --button-from: #f97316; /* orange-500 */
  --button-to: #dc2626;   /* red-600 */
}
```

## 调试

### 控制台日志

拖拽过程会输出日志：

```
[DragButton] Drag started: { text: "Hello World", sourceType: "paragraph" }
[CanvasDropZone] Drop successful: { success: true, elements: [...], binding: {...} }
[EnhancedExcalidraw] Elements created: 2
[createCanvasBinding] Binding created: uuid-xxx
```

### 常见问题

**Q: 按钮不出现？**
- 确保选中了至少 4 个字符
- 检查是否在编辑器容器内

**Q: 拖拽没有反应？**
- 查看控制台是否有错误
- 检查 canvas 是否正确初始化
- 验证数据库连接

**Q: 元素样式不对？**
- 检查 sourceType 检测是否正确
- 查看 drag-drop-bridge.ts 的样式配置

## 文件清单

```
components/
  ├── drag-button.tsx              # 拖拽按钮组件 (新增)
  └── editor.tsx                   # 编辑器 (已更新)

lib/canvas/
  ├── drag-drop-types.ts           # 类型定义
  ├── drag-drop-bridge.ts          # 核心逻辑

components/canvas/
  ├── canvas-drop-zone.tsx         # 放置区域
  ├── enhanced-excalidraw.tsx      # Excalidraw 集成

actions/
  ├── canvas.ts                    # Canvas CRUD
  └── canvas-bindings.ts           # 绑定管理
```

## 总结

新的**拖拽按钮**方案提供了更直观、更友好的交互体验：

- 🎯 **零学习成本** - 看到即会用
- 🚀 **性能优秀** - 流畅的拖拽体验
- 🎨 **视觉精美** - 手绘风格卡片
- 💾 **自动保存** - 无需手动操作
- 🔗 **智能绑定** - 文档和画布联动

立即体验：选中文字 → 拖拽按钮 → 创建卡片！✨
