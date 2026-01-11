"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { BlockNoteEditor, Selection } from "@blocknote/core";
import { useCreateBlockNote, FormattingToolbarController, GenericPopover } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@blocknote/core/fonts/inter.css";
import { SemanticCommandPalette } from "./semantic-command-palette";
import { toast } from "sonner";
import {
  defaultStyleSpecs,
  createStyleSpec,
  BlockNoteSchema,
  defaultBlockSpecs
} from "@blocknote/core";
import {
  createManualAnchor,
  acceptAiSuggestion,
  rejectAiSuggestion,
  renameNode
} from "@/actions/anchors";
import { db } from "@/db";
import { nodeSourceAnchors, semanticNodes } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { useSemanticSync } from "@/store/use-semantic-sync";
import { ExcalidrawBlock } from "./excalidraw-block";

interface EditorProps {
  onChange: (value: string) => void;
  initialContent?: string;
  editable?: boolean;
  userId?: string;
  documentId: string;
}

// 1. 定义语义主权自定义样式
const SemanticStyle = createStyleSpec(
  {
    type: "semantic",
    propSpecs: {
      anchorId: { default: "" },
      nodeId: { default: "" },
      provenance: { default: "AI" },
      isLocked: { default: "false" },
    },
  },
  {
    render: (props) => {
      const isLocked = props.isLocked === "true";
      const isAi = props.provenance === "AI";
      const isRejected = props.provenance === "USER_REJECTED";

      let className = "px-0.5 rounded-sm transition-all duration-300 ";

      if (isLocked && !isRejected) {
        // 主权锁定状态：紫色坚固感
        className += "bg-purple-500/10 border-b-2 border-purple-500/50 shadow-[0_2px_4px_rgba(168,85,247,0.1)]";
      } else if (isRejected) {
        // 被拒绝状态：红色警示
        className += "bg-rose-500/10 border-b-2 border-rose-500/30 line-through decoration-rose-500/50";
      } else if (isAi) {
        // AI 建议状态：琥珀色呼吸虚线
        className += "bg-amber-500/5 border-b-2 border-dashed border-amber-500/40 hover:bg-amber-500/10 animate-pulse";
      }

      return (
        <span
          className={className}
          data-anchor-id={props.anchorId}
          data-node-id={props.nodeId}
          data-is-locked={props.isLocked}
        >
          {props.children}
        </span>
      );
    },
  }
);

// 2. 注入自定义 Schema
const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    excalidraw: ExcalidrawBlock,
  },
  styleSpecs: {
    ...defaultStyleSpecs,
    semantic: SemanticStyle,
  },
});

/**
 * 语义主权面板：纯 UI 组件，由外部控制显示
 */
const SemanticSovereigntyPalette = (props: {
  editor: BlockNoteEditor,
  selectionText: string,
  onAction: any,
  existingAnchor?: any
}) => {
  const [coords, setCoords] = useState<{ x: number, y: number } | null>(null);

  useEffect(() => {
    const updateCoords = () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        // 如果 rect 为空或者 top 为 0（可能未渲染），不更新
        if (rect && (rect.width > 0 || rect.height > 0)) {
          setCoords({
            x: rect.left + rect.width / 2,
            y: rect.top - 12 // 在选区上方 12px
          });
        }
      }
    };

    updateCoords();
    // 监听滚动与改变大小，确保面板跟随
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [props.selectionText]);

  if (!coords) return null;

  return (
    <div
      className="fixed z-[999999]"
      style={{
        left: `${coords.x}px`,
        top: `${coords.y}px`,
        transform: "translate(-50%, -100%)",
        pointerEvents: "auto"
      }}
    >
      <div className="relative">
        <SemanticCommandPalette
          selectionText={props.selectionText}
          onAction={props.onAction}
          existingAnchor={props.existingAnchor}
        />
        {/* 指向文本的小三角 */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-background border-r border-b border-white/5 rotate-45 shadow-sm" />
      </div>
    </div>
  );
};

const Editor = ({ onChange, initialContent, editable, userId, documentId }: EditorProps) => {
  const { resolvedTheme } = useTheme();
  const [activeSelection, setActiveSelection] = useState("");
  const [existingAnchor, setExistingAnchor] = useState<any>(null);
  const { activeNodeId, setActiveNode } = useSemanticSync();

  const handleUpload = async (file: File) => {
    const { getUploadUrl } = await import("@/actions/storage");
    const key = `${Date.now()}-${file.name}`;
    const { url, publicUrl } = await getUploadUrl(key, file.type);

    await fetch(url, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });

    return publicUrl;
  };

  const editor = useCreateBlockNote({
    schema,
    initialContent: initialContent ? JSON.parse(initialContent) : undefined,
    uploadFile: handleUpload,
  });

  // 注入上下文到 editor 实例，以便自定义 Block 访问
  useEffect(() => {
    if (editor) {
      (editor as any)._documentId = documentId;
      (editor as any)._userId = userId;
    }
  }, [editor, documentId, userId]);

  useEffect(() => {
    if (editor) {
      return editor.onSelectionChange(async () => {
        const text = editor.getSelectedText();
        setActiveSelection(text);

        // 高级检测：检查当前光标位置是否在 semantic 样式内
        const selection = editor.getSelection();
        if (selection) {
          // 获取当前选区的所有样式
          const activeStyles = editor.getActiveStyles();
          if (activeStyles.semantic) {
            const s = activeStyles.semantic as any;
            console.log("[Arbitration] Style detected:", s);

            // 同步至图谱中枢
            setActiveNode(s.nodeId);

            setExistingAnchor({
              id: s.anchorId,
              nodeId: s.nodeId,
              title: text || "Selected Concept", // 降级处理
              provenance: s.provenance,
              isLocked: s.isLocked === "true"
            });
            return;
          }
        }

        // 如果点到了空白处，且没有有效选区，清空图中的高亮（可选）
        if (!text) {
          // setActiveNode(null); 
        }
        setExistingAnchor(null);
      });
    }
  }, [editor, setActiveNode]);

  // 当图中点击节点时，同步编辑器高亮/跳转
  useEffect(() => {
    if (activeNodeId && editor) {
      console.log(`[Editor] Syncing from Graph: nodeId=${activeNodeId}`);
      // 查找所有包含该 nodeId 的 DOM 元素 (由 SemanticStyle 渲染)
      const element = document.querySelector(`span[data-node-id="${activeNodeId}"]`) as HTMLElement;

      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });

        // 视觉反馈：瞬间闪烁
        element.animate([
          { outline: "2px solid #a855f7", outlineOffset: "4px", backgroundColor: "rgba(168, 85, 247, 0.3)" },
          { outline: "0px solid transparent" }
        ], { duration: 1500, easing: "ease-out" });
      }
    }
  }, [activeNodeId, editor]);

  const handleSemanticAction = async (action: string, data?: any) => {
    console.log("[SemanticAction] Triggered:", action, data);

    // 获取当前 Block
    const selectedBlocks = editor.getSelection()?.blocks || [];
    const targetBlock = selectedBlocks[0];
    console.log("[SemanticAction] Target Block:", targetBlock?.id);

    if (!targetBlock || !targetBlock.id) {
      toast.error("Please select text within a valid block");
      return;
    }

    if (!userId) {
      console.error("[SemanticAction] Missing userId");
      toast.error("User ID not found");
      return;
    }

    try {
      if (action === "create") {
        console.log("[SemanticAction] Calling createManualAnchor...");

        // 解析当前 Block 的纯文本
        let blockText = "";
        if (Array.isArray(targetBlock.content)) {
          blockText = targetBlock.content
            .map((c: any) => (c.type === "text" ? c.text : ""))
            .join("");
        }

        const res = await createManualAnchor({
          blockId: targetBlock.id,
          documentId: documentId,
          userId: userId,
          title: data.title,
          type: "concept",
          startOffset: 0,
          endOffset: data.title.length,
          blockText: blockText,
          blockType: targetBlock.type
        });
        console.log("[SemanticAction] Resp:", res);
        if (res.success) toast.success("Concept created and locked");
      } else if (action === "accept") {
        const res = await acceptAiSuggestion(data.id);
        if (res.success) toast.success("Suggestion accepted");
        setExistingAnchor(null); // 完成仲裁，清除状态
      } else if (action === "reject") {
        const res = await rejectAiSuggestion(data.id);
        if (res.success) toast.error("Suggestion rejected and blocked");
        setExistingAnchor(null);
      } else if (action === "rename") {
        const res = await renameNode(data.nodeId, data.newTitle);
        if (res.success) toast.success(`Renamed to "${data.newTitle}"`);
      }
    } catch (err) {
      toast.error("Action failed");
    }
  };

  return (
    <div className="relative group/editor">
      <BlockNoteView
        editable={editable}
        editor={editor}
        onChange={() => {
          onChange(JSON.stringify(editor.document));
        }}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        formattingToolbar={false}
      />
      {activeSelection && (
        <SemanticSovereigntyPalette
          editor={editor}
          selectionText={activeSelection}
          onAction={handleSemanticAction}
          existingAnchor={existingAnchor}
        />
      )}
    </div>
  );
};

export default Editor;
