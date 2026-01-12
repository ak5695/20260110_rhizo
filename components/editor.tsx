"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "next-themes";
import { BlockNoteEditor, Selection } from "@blocknote/core";
import { useCreateBlockNote, FormattingToolbarController, GenericPopover, createReactBlockSpec, createReactStyleSpec, SuggestionMenuController, getDefaultReactSlashMenuItems } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@blocknote/core/fonts/inter.css";
import { SemanticCommandPalette } from "./semantic-command-palette";
import { toast } from "sonner";
import { Loader2, Zap, FileIcon, FilePlus } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { getById } from "@/actions/documents";
import {
  defaultBlockSpecs,
  defaultProps,
  BlockNoteSchema,
  defaultStyleSpecs,
} from "@blocknote/core";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import {
  createManualAnchor,
  acceptAiSuggestion,
  rejectAiSuggestion,
  renameNode
} from "@/actions/anchors";
import { create as serverCreateDocument } from "@/actions/documents";
import { useSemanticSync } from "@/store/use-semantic-sync";
import { AiChatModal } from "./ai-chat-modal";

// Dynamic import for Excalidraw
const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  { ssr: false }
);

/**
 * Excalidraw 语义化方块
 */
/**
 * Excalidraw 语义化方块
 */
const ExcalidrawBlock = createReactBlockSpec(
  {
    type: "excalidraw",
    propSchema: {
      backgroundColor: { default: "default" },
      textColor: { default: "default" },
      textAlignment: { default: "left", values: ["left", "center", "right", "justify"] as const },
      data: { default: "[]" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const { resolvedTheme } = useTheme();
      const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

      const handleChange = (elements: any) => {
        editor.updateBlock(block, {
          type: "excalidraw",
          props: { data: JSON.stringify(elements) },
        });
      };

      const handleCaptureSemantic = async () => {
        if (!excalidrawAPI) return;
        const selectedElements = excalidrawAPI.getSelectedElements();
        const textElements = selectedElements.filter((el: any) => el.type === "text");

        if (textElements.length === 0) {
          toast.error("Please select a text element on the canvas first");
          return;
        }

        const keyword = textElements[0].text;
        const nodeId = textElements[0].id;

        toast.loading(`Capturing "${keyword}"...`, { id: "excalidraw-sync" });

        try {
          const res = await createManualAnchor({
            blockId: block.id,
            documentId: (editor as any)._documentId || "",
            userId: (editor as any)._userId || "",
            title: keyword,
            type: "concept",
            startOffset: 0,
            endOffset: keyword.length,
            blockText: "[Canvas Content]",
            blockType: "excalidraw",
            metadata: {
              source: "excalidraw",
              elementId: nodeId,
              capturedAt: new Date().toISOString(),
              documentId: (editor as any)._documentId
            }
          });

          if (res.success) {
            toast.success(`Concept "${keyword}" unified`, { id: "excalidraw-sync" });
          }
        } catch (error) {
          toast.error("Capture failed", { id: "excalidraw-sync" });
        }
      };

      return (
        <div className="relative w-full h-[500px] border border-white/5 rounded-xl overflow-hidden group/canvas bg-background shadow-inner">
          <div className="absolute top-2 right-2 z-50 flex gap-2 opacity-0 group-hover/canvas:opacity-100 transition-opacity">
            <button
              onClick={handleCaptureSemantic}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/30 rounded-lg backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-purple-200 transition-all"
            >
              <Zap className="w-3 h-3 fill-current" />
              Mark Concept
            </button>
          </div>

          <Excalidraw
            excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
            initialData={{
              elements: JSON.parse(block.props.data || "[]"),
              appState: { theme: resolvedTheme === "dark" ? "dark" : "light" }
            }}
            onChange={handleChange}
            theme={resolvedTheme === "dark" ? "dark" : "light"}
          />
        </div>
      );
    },
  }
);

/**
 * Page Block: 仿 Notion 的子页面入口
 */
const PageBlock = createReactBlockSpec(
  {
    type: "page",
    propSchema: {
      ...defaultProps,
      pageId: { default: "" },
      title: { default: "Untitled" },
    },
    content: "none",
  },
  {
    render: ({ block }) => {
      const router = useRouter();
      const { data: pageData } = useSWR(
        block.props.pageId ? `page-${block.props.pageId}` : null,
        () => getById(block.props.pageId)
      );

      const title = pageData?.title || block.props.title || "Untitled";

      return (
        <div
          onClick={() => router.push(`/documents/${block.props.pageId}`)}
          className="flex items-center gap-x-3 w-full p-2.5 my-1 rounded-xl bg-muted/30 hover:bg-muted/60 dark:bg-white/5 dark:hover:bg-white/10 cursor-pointer group transition-all border border-border/20 hover:border-border/60 hover:shadow-sm"
        >
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-background border border-border/40 shadow-sm group-hover:scale-110 transition-transform">
            {pageData?.icon ? (
              <span className="text-lg">{pageData.icon}</span>
            ) : (
              <FileIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            )}
          </div>
          <div className="flex flex-col gap-0.5 overflow-hidden">
            <span className="font-semibold text-sm text-foreground/90 group-hover:text-foreground transition-colors truncate">
              {title}
            </span>
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-tight">
              Sub-Page
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
            <Zap className="h-3 w-3 text-purple-500/50" />
            <div className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold">OPEN</div>
          </div>
        </div>
      );
    },
  }
);

interface EditorProps {
  onChange: (value: string) => void;
  initialContent?: string;
  editable?: boolean;
  userId?: string;
  documentId: string;
}

// 1. 定义语义主权自定义样式
const SemanticStyle = createReactStyleSpec(
  {
    type: "semantic",
    propSchema: "string",
  },
  {
    render: ({ value, children, contentRef }: any) => {
      // Parse semantic data from JSON string
      let data = { anchorId: "", nodeId: "", provenance: "AI", isLocked: "false" };
      try {
        if (value) data = JSON.parse(value);
      } catch (e) { }

      const isLocked = data.isLocked === "true";
      const isAi = data.provenance === "AI";
      const isRejected = data.provenance === "USER_REJECTED";

      let className = "px-0.5 rounded-sm transition-all duration-300 ";

      if (isLocked && !isRejected) {
        className += "bg-purple-500/10 border-b-2 border-purple-500/50 shadow-[0_2px_4px_rgba(168,85,247,0.1)]";
      } else if (isRejected) {
        className += "bg-rose-500/10 border-b-2 border-rose-500/30 line-through decoration-rose-500/50";
      } else if (isAi) {
        className += "bg-amber-500/5 border-b-2 border-dashed border-amber-500/40 hover:bg-amber-500/10 animate-pulse";
      }

      return (
        <span
          ref={contentRef}
          className={className}
          data-anchor-id={data.anchorId}
          data-node-id={data.nodeId}
          data-is-locked={data.isLocked}
        >
          {children}
        </span>
      );
    },
  }
);

// 2. 注入自定义 Schema
const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    excalidraw: ExcalidrawBlock(),
    page: PageBlock(),
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
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiModalPosition, setAiModalPosition] = useState({ top: 0, left: 0 });
  const router = useRouter();

  // Store cursor block ID for restoration after AI modal closes
  const savedCursorBlockRef = useRef<string | null>(null);

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

  // Handle space key on empty line to open AI modal
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger if AI modal is open - handled by modal itself
      if (showAiModal) return;

      if (event.key === " " && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
        const cursorPosition = editor.getTextCursorPosition();
        const currentBlock = cursorPosition.block;

        // Get block text content
        let blockText = "";
        if (currentBlock.content && Array.isArray(currentBlock.content)) {
          blockText = currentBlock.content.map((c: any) => c.text || "").join("");
        }

        // Check if current line is empty
        if (blockText.trim() === "") {
          event.preventDefault();
          event.stopPropagation();

          // Save current block ID for cursor restoration
          savedCursorBlockRef.current = currentBlock.id;

          // Get cursor position for modal placement
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setAiModalPosition({
              top: rect.top + window.scrollY + 20,
              left: rect.left + window.scrollX,
            });
          }

          setShowAiModal(true);
        }
      }
    };

    const editorElement = document.querySelector(".bn-container");
    if (editorElement) {
      editorElement.addEventListener("keydown", handleKeyDown as any, true);
      return () => editorElement.removeEventListener("keydown", handleKeyDown as any, true);
    }
  }, [editor, showAiModal]);

  // Restore cursor position when AI modal closes
  const handleCloseAiModal = useCallback(() => {
    setShowAiModal(false);

    // Restore focus to editor and cursor position
    setTimeout(() => {
      if (editor && savedCursorBlockRef.current) {
        const block = editor.getBlock(savedCursorBlockRef.current);
        if (block) {
          editor.focus();
          editor.setTextCursorPosition(block, "end");
        }
        savedCursorBlockRef.current = null;
      } else if (editor) {
        editor.focus();
      }
    }, 50);
  }, [editor]);

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
            let s = { anchorId: "", nodeId: "", provenance: "AI", isLocked: "false" };
            try {
              s = JSON.parse(activeStyles.semantic as string);
            } catch (e) { }

            console.log("[Arbitration] Style detected:", s);

            setActiveNode(s.nodeId);

            setExistingAnchor({
              id: s.anchorId,
              nodeId: s.nodeId,
              title: text || "Selected Concept",
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
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            filterSuggestionItems(
              [
                ...getDefaultReactSlashMenuItems(editor),
                {
                  title: "Sub-page",
                  onItemClick: async () => {
                    const promise = serverCreateDocument({ title: "Untitled", parentDocumentId: documentId });

                    toast.promise(promise, {
                      loading: "Creating sub-page...",
                      success: (doc) => {
                        // Local insertion for immediate feedback
                        editor.insertBlocks(
                          [
                            {
                              type: "page",
                              props: {
                                pageId: doc.id,
                                title: doc.title || "Untitled",
                                backgroundColor: "default",
                                textColor: "default",
                                textAlignment: "left"
                              }
                            }
                          ],
                          editor.getTextCursorPosition().block,
                          "after"
                        );

                        router.push(`/documents/${doc.id}`);
                        return "Sub-page created";
                      },
                      error: "Failed to create sub-page"
                    });
                  },
                  aliases: ["page", "subpage", "new"],
                  group: "Basic Blocks",
                  icon: <FilePlus className="h-4 w-4" />,
                  subtext: "Create a nested sub-page",
                },
              ],
              query
            )
          }
        />
      </BlockNoteView>
      {/* SemanticSovereigntyPalette removed - functionality moved to SelectionToolbar */}
      <AiChatModal
        isOpen={showAiModal}
        onClose={handleCloseAiModal}
        position={aiModalPosition}
        onInsertText={async (text) => {
          if (editor) {
            const targetBlock = savedCursorBlockRef.current
              ? editor.getBlock(savedCursorBlockRef.current)
              : editor.getTextCursorPosition().block;

            if (targetBlock) {
              try {
                // Try to parse markdown to blocks for beautified insertion
                const blocks = await editor.tryParseMarkdownToBlocks(text);

                // Insert blocks after target
                editor.insertBlocks(blocks, targetBlock, "after");

                // Move cursor to the end of the last inserted block
                // We find it by traversing nextBlock from targetBlock
                setTimeout(() => {
                  let lastInsertedBlock = targetBlock;
                  for (let i = 0; i < blocks.length; i++) {
                    const next = editor.getNextBlock(lastInsertedBlock);
                    if (next) {
                      lastInsertedBlock = next;
                    } else {
                      break;
                    }
                  }

                  if (lastInsertedBlock !== targetBlock) {
                    editor.setTextCursorPosition(lastInsertedBlock, "end");
                  }
                }, 100);
              } catch (error) {
                console.error("Failed to parse markdown to blocks:", error);
                // Fallback to simple paragraph insertion if parsing fails
                const fallbackBlock = {
                  type: "paragraph",
                  content: text,
                } as any;

                editor.insertBlocks([fallbackBlock], targetBlock, "after");

                setTimeout(() => {
                  const next = editor.getNextBlock(targetBlock);
                  if (next) {
                    editor.setTextCursorPosition(next, "end");
                  }
                }, 100);
              }
            }
          }
        }}
      />
    </div>
  );
};

export default Editor;
