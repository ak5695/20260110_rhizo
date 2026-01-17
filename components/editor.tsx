"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { useTheme } from "next-themes";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@blocknote/core/fonts/inter.css";
import { SelectionToolbar } from "./selection-toolbar";
import { toast } from "sonner";
import { FilePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import debounce from "lodash.debounce";
import { create as serverCreateDocument } from "@/actions/documents";
import {
  createManualAnchor,
  acceptAiSuggestion,
  rejectAiSuggestion,
  renameNode
} from "@/actions/anchors";
import { useSemanticSync } from "@/store/use-semantic-sync";
import { useNavigationStore, useBlockTarget } from "@/store/use-navigation-store";
import { AiChatModal } from "./ai-chat-modal";
import { useBindingSync } from "@/hooks/use-binding-sync";
import { ExcalidrawGenerationModal } from "./excalidraw-generation-modal";
import { FormattingToolbarController, SuggestionMenuController, getDefaultReactSlashMenuItems } from "@blocknote/react";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import { schema } from "./editor/config/schema";
import { EditorBindingOverlay } from "./editor/overlays/editor-binding-overlay";

interface EditorProps {
  onChange: (value: string) => void;
  initialContent?: string;
  editable?: boolean;
  userId?: string;
  documentId: string;
  onDocumentChange?: (document: any) => void; // Expose document for outline
}

const EditorComponent = ({ onChange, initialContent, editable, userId, documentId, onDocumentChange }: EditorProps) => {
  const { resolvedTheme } = useTheme();
  const [activeSelection, setActiveSelection] = useState("");
  const [existingAnchor, setExistingAnchor] = useState<any>(null);
  const { activeNodeId, setActiveNode } = useSemanticSync();
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiModalPosition, setAiModalPosition] = useState({ top: 0, left: 0 });
  const { bindings: bindingsMap } = useBindingSync(documentId); // Cache-first Sync
  const bindings = useMemo(() => Array.from(bindingsMap.values()), [bindingsMap]);
  const [deletedElementIds, setDeletedElementIds] = useState<Set<string>>(new Set());
  const [hasLiveInfo, setHasLiveInfo] = useState(false);

  // Excalidraw Gen State
  const [showExcalidrawGen, setShowExcalidrawGen] = useState(false);
  const [excalidrawGenPrompt, setExcalidrawGenPrompt] = useState("");
  const [excalidrawGenPos, setExcalidrawGenPos] = useState({ top: 0, left: 0 });

  const router = useRouter();

  // DEBUG: Monitor focus loss events
  useEffect(() => {
    const handleFocus = () => console.log("[FocusMonitor] Window Focused");
    const handleBlur = (e: FocusEvent) => {
      console.log("[FocusMonitor] Window Blurred", {
        activeElement: document.activeElement,
        relatedTarget: e.relatedTarget
      });
      // console.trace("[FocusMonitor] Blur Trace");
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // DEBUG: Monitor Component Remounts
  // DEBUG: Monitor Component Remounts
  useEffect(() => {
    // console.log("[Editor] Component Mounted/Remounted");
    return () => {
      // console.log("[Editor] Component Unmounted");
    };
  }, []);

  // Use Zustand navigation store (Hoisted)
  const blockTarget = useBlockTarget();
  const { clearBlockTarget, jumpToElement, highlightedElementId, highlightedBlockId } = useNavigationStore();

  // Store cursor block ID for restoration after AI modal closes
  const savedCursorBlockRef = useRef<string | null>(null);

  // Stabilize upload handler to prevent editor recreation
  const handleUpload = useCallback(async (file: File) => {
    const { getUploadUrl } = await import("@/actions/storage");
    const key = `${Date.now()}-${file.name}`;
    const { url, publicUrl } = await getUploadUrl(key, file.type);

    await fetch(url, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });

    return publicUrl;
  }, []);

  // Real-time content sync to canvas
  const debouncedSync = useCallback(
    debounce((blockId: string, text: string) => {
      // window.dispatchEvent(new CustomEvent('document:block-change', {
      //   detail: { blockId, text }
      // }));
    }, 500),
    []
  );

  // Track last edit time to prevent overwriting user changes with server data
  const lastEditTimeRef = useRef<number>(0);
  // Flag to ignore changes triggered by remote updates
  const isRemoteUpdateRef = useRef(false);

  // Stabilize initial content to prevent editor re-construction on every render
  const stableInitialContent = useMemo(() => {
    // 1. HMR Recovery: Check global backup first
    // 1. HMR Recovery: Check sessionStorage backup first (More durable than window)
    if (typeof window !== "undefined") {
      try {
        const backupStr = sessionStorage.getItem(`JOTION_BACKUP_${documentId}`);
        if (backupStr) {
          const backup = JSON.parse(backupStr);
          if (Date.now() - backup.timestamp < 30000) { // 30s window (survives full reload)
            console.log("[Editor] Recovery: Restoring content from sessionStorage");
            return typeof backup.content === 'string' ? JSON.parse(backup.content) : backup.content;
          }
        }
      } catch (e) { console.error("Backup restore failed", e); }
    }
    // 2. Fallback to props
    return initialContent ? JSON.parse(initialContent) : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps ensures this never changes after mount

  const editor = useCreateBlockNote({
    schema,
    initialContent: stableInitialContent,
    uploadFile: handleUpload,
  });

  // 2. Focus Restoration (Surviving HMR/Fast Refresh)
  useEffect(() => {
    if (!editor) return;

    // A: Check if we should restore focus (on mount)
    // A: Check if we should restore focus (on mount)
    if (typeof window !== "undefined") {
      const activeState = sessionStorage.getItem(`JOTION_FOCUS_${documentId}`);

      if (activeState) {
        try {
          const { timestamp, blockId, wasFocused } = JSON.parse(activeState);
          const isRecent = Date.now() - timestamp < 30000;

          if (wasFocused && isRecent) {
            console.log("[Editor] Focus Recovery: Restoring focus/cursor from SessionStorage");

            // Execute restoration
            setTimeout(() => {
              editor.focus();
              if (blockId) {
                const block = editor.getBlock(blockId);
                if (block) {
                  editor.setTextCursorPosition(block, "end");
                }
              }
            }, 100);
          }
        } catch (e) { console.error(e); }
      }
    }

    // B: Track focus state

    const cleanups: (() => void)[] = [];

    // Track via selection change (most reliable for "user is typing")
    // Track via selection change (most reliable for "user is typing")
    cleanups.push(editor.onSelectionChange(() => {
      // Persist Focus State into SessionStorage
      if (editor.isFocused()) {
        try {
          const cursor = editor.getTextCursorPosition();
          const state = {
            timestamp: Date.now(),
            wasFocused: true,
            blockId: cursor.block?.id
          };
          sessionStorage.setItem(`JOTION_FOCUS_${documentId}`, JSON.stringify(state));
        } catch (e) { }
      }
    }));

    // Track via DOM events
    const domElement = document.querySelector(".bn-editor");
    if (domElement) {
      const onFocus = (e: FocusEvent) => {
        console.log(`[EditorMonitor-${editor._instanceId}] Editor Focused`, {
          target: (e.target as HTMLElement).tagName,
          relatedTarget: (e.relatedTarget as HTMLElement)?.tagName
        });

        // Fallback tracking
        sessionStorage.setItem(`JOTION_FOCUS_${documentId}`, JSON.stringify({
          timestamp: Date.now(),
          wasFocused: true
        }));
      };

      const onBlur = (e: FocusEvent) => {
        console.log(`[EditorMonitor-${editor._instanceId}] Editor Blurred`, {
          target: (e.target as HTMLElement).tagName,
          relatedTarget: (e.relatedTarget as HTMLElement)?.tagName,
          newActiveElement: document.activeElement?.tagName
        });
      };

      const onMouseDown = (e: MouseEvent) => {
        console.log(`[EditorMonitor-${editor._instanceId}] Mouse Down`, {
          target: (e.target as HTMLElement).tagName,
          blockId: (e.target as HTMLElement).closest('[data-id]')?.getAttribute('data-id')
        });
      };

      const onInput = (e: Event) => {
        console.log(`[EditorMonitor-${editor._instanceId}] Input Event`, {
          type: e.type,
          // text: (e as any).data
        });
      };

      domElement.addEventListener("focus", onFocus as any, true);
      domElement.addEventListener("blur", onBlur as any, true); // capture
      domElement.addEventListener("mousedown", onMouseDown as any, true);
      domElement.addEventListener("input", onInput as any, true);

      cleanups.push(() => {
        domElement.removeEventListener("focus", onFocus as any, true);
        domElement.removeEventListener("blur", onBlur as any, true);
        domElement.removeEventListener("mousedown", onMouseDown as any, true);
        domElement.removeEventListener("input", onInput as any, true);
      });
    }

    return () => {
      cleanups.forEach(fn => fn());
    };
  }, [editor]);

  // Handle space key on empty line to open AI modal
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger if AI modal is open - handled by modal itself
      if (showAiModal) return;

      // DISABLE Space-to-AI completely as per user request to fix focus loss
      /*
      if (event.key === " " && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
        const cursorPosition = editor.getTextCursorPosition();
        const currentBlock = cursorPosition.block;

        // Robust content extraction
        let blockText = "";
        if (currentBlock.content && Array.isArray(currentBlock.content)) {
          blockText = currentBlock.content.map((c: any) => c.text || "").join("");
        }

        // Only trigger if block is strictly empty
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
      */
    };

    const editorElement = document.querySelector(".bn-container");
    if (editorElement) {
      editorElement.addEventListener("keydown", handleKeyDown as any, true);
    }

    // Listen for external insert events (e.g. from Q&A List Global Chat)
    const handleInsertText = async (e: CustomEvent) => {
      if (editor && e.detail) {
        const blocks = await editor.tryParseMarkdownToBlocks(e.detail);

        // Insert at the end of the document
        const runAsync = async () => {
          const lastBlock = editor.document[editor.document.length - 1];
          editor.insertBlocks(
            blocks,
            lastBlock,
            "after"
          );

          // Scroll to bottom to show new content
          // We need to wait for render or just use a simple timeout/scroll
          setTimeout(() => {
            const scrollingElement = document.querySelector(".h-full.overflow-y-auto.custom-scrollbar");
            if (scrollingElement) {
              scrollingElement.scrollTo({ top: scrollingElement.scrollHeight, behavior: 'smooth' });
            }
          }, 100);
        };
        runAsync();
      }
    };
    window.addEventListener("editor:insert-text", handleInsertText as unknown as EventListener);

    return () => {
      if (editorElement) {
        editorElement.removeEventListener("keydown", handleKeyDown as any, true);
      }
      window.removeEventListener("editor:insert-text", handleInsertText as unknown as EventListener);
    };
  }, [editor, showAiModal]);

  // Listen for Drag Check-in (Feedback Loop - Drag to Bind)
  // 【即时标记】使用 sessionStorage 中保存的选区信息
  useEffect(() => {
    if (!editor) return;

    const handleCanvasBindingSuccess = (e: CustomEvent) => {
      const { elementId, blockId, optimistic } = e.detail;

      console.log("[Editor] Canvas binding success event received:", { elementId, blockId, optimistic });

      // 1. Try to get selection info from metadata (Reliable - passed via Drag Payload)
      let savedSelection: { blockId: string; selectedText: string; timestamp: number } | null = null;
      const metadataFn = e.detail.metadata;

      if (metadataFn && metadataFn.selectionInfo) {
        savedSelection = metadataFn.selectionInfo;
        console.log("[Editor] Using selection info from metadata:", savedSelection);
      }
      // 2. Fallback to sessionStorage (Legacy/Unreliable)
      else {
        const savedSelectionStr = sessionStorage.getItem('pendingDragSelection');
        if (savedSelectionStr) {
          try {
            savedSelection = JSON.parse(savedSelectionStr);
            console.log("[Editor] Using selection info from sessionStorage");
          } catch (e) {
            console.error("[Editor] Failed to parse saved selection:", e);
          }
        }
      }

      if (!savedSelection) {
        console.warn("[Editor] No selection info found (neither in metadata nor sessionStorage)");
        return;
      }

      // 验证选区信息的有效性（5秒内有效）
      // If from metadata, it's part of the transaction, so usually valid.
      const isValid = savedSelection &&
        savedSelection.blockId === blockId;
      // && (Date.now() - savedSelection.timestamp) < 5000; // Relax timestamp check for robustness

      if (!isValid) {
        console.warn("[Editor] Selection info mismatch or invalid", { saved: savedSelection, current: blockId });
        return;
      }

      console.log("[Editor] Using saved selection:", savedSelection);

      // 【即时应用样式】使用 BlockNote API
      // 【即时应用样式】使用 BlockNote API (Global Auto-Linking)
      try {
        const searchText = savedSelection.selectedText;
        if (!searchText) return;

        let updateCount = 0;

        // Iterate ALL blocks to find and link the text
        editor.forEachBlock((block) => {
          if (!block.content || !Array.isArray(block.content)) return true;

          // 1. Performance Guard: Check if block text contains our search term at all
          const blockText = block.content.reduce((acc: string, curr: any) => acc + (curr.text || ''), '');
          if (!blockText.includes(searchText)) return true;

          // 2. Scan content and transform
          const newContent = block.content.map((item: any) => {
            if (item.type === 'text' && item.text && item.text.includes(searchText)) {
              // 3. Precision Check: If this item is already correctly linked, skip processing it
              // We check styles to see if it already has the SAME canvasLink
              if (item.styles?.canvasLink === elementId) return [item];

              const parts: any[] = [];
              let remaining = item.text;
              const currentStyles = item.styles || {};

              // Split precisely on search term
              while (remaining.includes(searchText)) {
                const i = remaining.indexOf(searchText);
                const before = remaining.substring(0, i);
                const match = searchText;
                const after = remaining.substring(i + match.length);

                if (before) parts.push({ type: 'text', text: before, styles: currentStyles });

                parts.push({
                  type: 'text',
                  text: match,
                  styles: {
                    ...currentStyles,
                    canvasLink: elementId,
                    textColor: 'orange',
                    backgroundColor: 'red'
                  }
                });
                remaining = after;
              }
              if (remaining) parts.push({ type: 'text', text: remaining, styles: currentStyles });
              return parts;
            }
            return [item];
          }).flat();

          // 4. Performance Guard: Only call updateBlock if content actually CHANGED
          // This avoids massive DOM thrashing in large documents
          if (JSON.stringify(block.content) !== JSON.stringify(newContent)) {
            editor.updateBlock(block, { content: newContent });
            updateCount++;
          }
          return true;
        });

        console.log(`[Editor] Global Auto-Linking applied to ${updateCount} blocks for "${searchText}"`);

      } catch (err) {
        console.error("[Editor] Failed to apply canvasLink style:", err);
      }

      // 清理 sessionStorage
      sessionStorage.removeItem('pendingDragSelection');
    };

    // Listen for direct text click to jump to canvas
    const handleJumpToElement = (e: CustomEvent) => {
      const { elementId } = e.detail;
      if (elementId) {
        console.log("[Editor] Jumping to canvas element:", elementId);
        jumpToElement(elementId);
      }
    };

    window.addEventListener("document:canvas-binding-success", handleCanvasBindingSuccess as EventListener);
    window.addEventListener("canvas:jump-to-element", handleJumpToElement as EventListener);

    return () => {
      window.removeEventListener("document:canvas-binding-success", handleCanvasBindingSuccess as EventListener);
      window.removeEventListener("canvas:jump-to-element", handleJumpToElement as EventListener);
    };
  }, [editor]);

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
      if (!(editor as any)._instanceId) {
        (editor as any)._instanceId = Math.random().toString(36).slice(2, 7);
      }
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

  // 【EAS】监听绑定状态变更事件，使用CSS Ghosting（非破坏性）
  useEffect(() => {
    const handleBindingHidden = (e: CustomEvent) => {
      const { bindingId, elementId } = e.detail;
      console.log('[Editor] Binding hidden:', bindingId, elementId);

      // 从 state 移除（UI不再显示为活跃）
      setDeletedElementIds(prev => {
        const next = new Set(prev);
        next.add(elementId);
        return next;
      });
      setHasLiveInfo(true);

      // 应用 CSS ghosting（非破坏性，可恢复）
      const boundTexts = document.querySelectorAll(
        `.canvas-bound-text[data-canvas-link="${elementId}"]`
      );
      boundTexts.forEach(el => {
        el.classList.add('is-deleted');
        console.log('[Editor] Applied ghosting to element:', elementId);
      });
    };

    const handleBindingShown = (e: CustomEvent) => {
      const { bindingId, elementId } = e.detail;
      console.log('[Editor] Binding shown (restore):', bindingId, elementId);

      setDeletedElementIds(prev => {
        const next = new Set(prev);
        next.delete(elementId);
        return next;
      });

      // 移除 CSS ghosting
      const boundTexts = document.querySelectorAll(
        `.canvas-bound-text[data-canvas-link="${elementId}"]`
      );
      boundTexts.forEach(el => {
        el.classList.remove('is-deleted');
        console.log('[Editor] Removed ghosting from element:', elementId);
      });

      // 可选：重新加载 bindings（触发刷新）
      window.dispatchEvent(new Event('refresh-bindings'));
    };

    window.addEventListener('binding:hidden', handleBindingHidden as EventListener);
    window.addEventListener('binding:shown', handleBindingShown as EventListener);

    return () => {
      window.removeEventListener('binding:hidden', handleBindingHidden as EventListener);
      window.removeEventListener('binding:shown', handleBindingShown as EventListener);
    };
  }, []);

  // Global Event Delegation for Canvas Links (Performance Optimization)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('.canvas-bound-text');
      if (link) {
        const elementId = link.getAttribute('data-canvas-link');
        if (elementId) {
          e.preventDefault();
          e.stopPropagation();
          jumpToElement(elementId);
        }
      }
    };
    // Use capture phase to ensure we intercept before editor internal selection logic
    window.addEventListener('click', handleClick, true);
    return () => window.removeEventListener('click', handleClick, true);
  }, [jumpToElement]);

  // Sync Deleted State from DB Bindings
  useEffect(() => {
    if (!Array.isArray(bindings)) return;
    const dbDeleted = new Set(bindings.filter(b => b.status === "deleted").map(b => b.elementId));
    if (!hasLiveInfo && dbDeleted.size > 0) {
      setDeletedElementIds(dbDeleted);
    }
  }, [bindings, hasLiveInfo]);

  // Listen for Live Canvas ghost updates (Soft logic)
  useEffect(() => {
    const handleStatusUpdate = (e: CustomEvent) => {
      const { deletedIds } = e.detail;
      if (Array.isArray(deletedIds)) {
        setDeletedElementIds(new Set(deletedIds));
        setHasLiveInfo(true);
      }
    };
    window.addEventListener("canvas:element-status-update", handleStatusUpdate as EventListener);
    return () => window.removeEventListener("canvas:element-status-update", handleStatusUpdate as EventListener);
  }, []);

  // Consolidated Surgical Update (O(1)ish - precisely targets only changed IDs)
  useEffect(() => {
    // 1. Clear previous highlights (targeted)
    document.querySelectorAll(".is-focused-block").forEach(el => el.classList.remove("is-focused-block"));
    document.querySelectorAll(".is-focused-link").forEach(el => el.classList.remove("is-focused-link"));
    document.querySelectorAll(".is-active-link").forEach(el => el.classList.remove("is-active-link"));

    // 2. Add highlight to target block
    if (highlightedBlockId) {
      const bEl = document.querySelector(`[data-id="${highlightedBlockId}"]`) as HTMLElement;
      if (bEl) {
        bEl.classList.add("is-focused-block");
        bEl.classList.add("is-active-link");
      }
    }

    // 3. Add highlight to target inline link (all occurrences)
    if (highlightedElementId) {
      const lEls = document.querySelectorAll(`[data-canvas-link="${highlightedElementId}"]`);
      if (lEls.length > 0) {
        console.log(`[Editor] Found ${lEls.length} link instances to highlight for ID:`, highlightedElementId);
        lEls.forEach(el => el.classList.add("is-focused-link"));
      } else {
        // Option B: If not in DOM yet (e.g. big document), maybe it will appear after scroll
        // But for now, pinpointing is better
        console.warn("[Editor] No link instances found in DOM yet for ID:", highlightedElementId);
      }
    }
  }, [highlightedBlockId, highlightedElementId]);

  // Handle ghosting for deleted elements (O(N) but only on status change, not keystroke)
  useEffect(() => {
    document.querySelectorAll('.canvas-bound-text').forEach(el => {
      const id = el.getAttribute('data-canvas-link');
      if (id && deletedElementIds.has(id)) {
        el.classList.add('is-deleted');
      } else {
        el.classList.remove('is-deleted');
      }
    });
  }, [deletedElementIds]);

  // 4. Handle Jump-to-Block from Canvas (via Zustand store)
  useEffect(() => {
    if (!blockTarget || !editor) return;

    const { id: blockId, label } = blockTarget;

    // 1. Clear previous active states
    document.querySelectorAll(".is-active-link").forEach(el => {
      el.classList.remove("is-active-link");
    });

    const element = document.querySelector(`[data-id="${blockId}"]`) as HTMLElement;
    if (element) {
      // 2. Scroll and apply persistent highlight
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("is-active-link");

      // 3. Ensure binding tag exists and update label
      let tag = element.querySelector(".binding-tag") as HTMLElement;
      if (!tag) {
        tag = document.createElement("div");
        tag.className = "binding-tag";
        element.appendChild(tag);
      }
      tag.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> 绑定: ${label || "画布节点"}`;
    }

    // Clear the target after navigation
    clearBlockTarget();
  }, [blockTarget, editor, clearBlockTarget]);

  // Handle clearing active link state when clicking editor
  useEffect(() => {
    const clearActive = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".is-active-link")) {
        document.querySelectorAll(".is-active-link").forEach(el => {
          el.classList.remove("is-active-link");
        });
      }
    };
    document.addEventListener("mousedown", clearActive);
    return () => document.removeEventListener("mousedown", clearActive);
  }, []);

  // 5. Block Decoration Logic (Surgical Updates - Enterprise Grade)
  const decorateBlocks = useCallback(() => {
    if (!bindings.length) return;

    // A: Clear stale indicators (blocks that are no longer in the bindings list)
    const activeBlockIds = new Set(bindings.map(b => b.blockId));
    document.querySelectorAll(".is-linked").forEach(el => {
      const id = el.getAttribute("data-id");
      if (!id || !activeBlockIds.has(id)) {
        el.classList.remove("is-linked");
        el.querySelector(".link-indicator")?.remove();
        el.querySelector(".binding-tag")?.remove();
      }
    });

    // B: Surgical Injection (Add only what's missing)
    bindings.forEach(binding => {
      if (!binding.blockId) return;

      // Try to find the element - handling BlockNote structure
      const element = document.querySelector(`[data-id="${binding.blockId}"]`);

      // Ensure we are targeting the content wrapper for styling
      if (element) {
        // Add class for CSS-based border and background
        if (!element.classList.contains("is-linked")) {
          element.classList.add("is-linked");
        }

        // Add a small indicator if doesn't exist
        const existingIndicator = element.querySelector(`.link-indicator[data-target="${binding.elementId}"]`);

        if (!existingIndicator) {
          const indicator = document.createElement("div");
          indicator.className = "link-indicator absolute -left-6 top-1.5 w-5 h-5 flex items-center justify-center text-orange-500 hover:text-orange-600 hover:bg-orange-50 rounded bg-white dark:bg-[#1f1f1f] shadow-sm border border-orange-200 dark:border-orange-900 cursor-pointer transition-all z-20 group/indicator";
          indicator.setAttribute("data-target", binding.elementId);
          // Use Link2 icon
          indicator.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link-2"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 0 1 0 10h-2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;
          indicator.title = "Jump to Canvas Element";

          indicator.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Use Zustand store to navigate to canvas element
            jumpToElement(binding.elementId);
          };

          // Ensure relative positioning
          if ((element as HTMLElement).style.position !== "relative") {
            (element as HTMLElement).style.position = "relative";
          }
          element.appendChild(indicator);
        }

        // Add Binding Tag (Cognitive Visibility - Top Right)
        if (!element.querySelector(".binding-tag")) {
          const tag = document.createElement("div");
          tag.className = "binding-tag";
          tag.textContent = "LINKED";
          element.appendChild(tag);
        }
      }
    });
  }, [bindings, jumpToElement]);

  // 6. Global delegated click listener for linked blocks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest(".is-linked");
      if (target) {
        const blockId = target.getAttribute("data-id");
        const binding = bindings.find(b => b.blockId === blockId);
        if (binding) {
          // If Alt is pressed or just click (decide UX later)
          // For now, let's say clicking the indicator (handled above) is enough,
          // OR we can make the block responsive.
        }
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [bindings]);

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

  // Handle Concept Creation from Selection Toolbar (Closing the Loop)
  const handleCreateConcept = async (text: string) => {
    if (!editor || !userId) return;

    // Get current selection block
    const selection = editor.getSelection();
    if (!selection || !selection.blocks.length) return;
    const block = selection.blocks[0];

    const promise = createManualAnchor({
      blockId: block.id,
      documentId: documentId,
      userId: userId,
      title: text,
      type: "concept",
      startOffset: 0,
      endOffset: text.length, // Approximate
      blockText: text, // This might be full block text, but for concept, usage 'text' is fine?
      blockType: block.type
    });

    toast.promise(promise, {
      loading: "Creating concept & binding...",
      success: (res) => {
        if (res.success && res.nodeId) {
          // APPLY STYLE "canvasLink" - Enterprise Gradient Binding
          editor.addStyles({ canvasLink: res.nodeId });
          return "Concept created and bound!";
        } else {
          throw new Error(res.error || "Failed");
        }
      },
      error: "Failed to create concept"
    });
  };

  const handleLinkExisting = (text: string) => {
    // Prompt for demo purposes
    const id = window.prompt("Enter Element ID to bind:");
    if (id) {
      editor.addStyles({ canvasLink: id });
      toast.success("Linked to existing element");
    }
  };

  // Sync bindings to ref to keep callback stable
  const bindingsRef = useRef(bindings);
  useEffect(() => {
    bindingsRef.current = bindings;
  }, [bindings]);

  // Memoize the change handler to prevent prop churn on BlockNoteView
  const handleEditorChange = useCallback(() => {
    // Track last edit time to prevent overwriting user changes with server data
    // And ignore changes triggered by remote updates
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }
    lastEditTimeRef.current = Date.now();

    const content = JSON.stringify(editor.document);

    // BACKUP for HMR/Reload Survival
    if (typeof window !== "undefined") {
      const backup = {
        documentId,
        content,
        timestamp: Date.now()
      };
      sessionStorage.setItem(`JOTION_BACKUP_${documentId}`, JSON.stringify(backup));
    }

    onChange(content);

    // Expose document for outline
    /*
    if (onDocumentChange) {
      onDocumentChange(editor.document);
    }
    */

    // Real-time Content Sync to Canvas (Enterprise Feature)
    try {
      const cursor = editor.getTextCursorPosition();
      if (cursor.block) {
        const block = cursor.block;
        // Use Ref to avoid recreating callback on binding updates
        const isBound = bindingsRef.current.some(b => b.blockId === block.id);
        if (isBound) {
          // Extract text robustly
          let text = "";
          if (Array.isArray(block.content)) {
            text = block.content.map(c => (c as any).text || "").join("");
          }
          debouncedSync(block.id, text);
        }
      }
    } catch (e) {
      // Silent catch for cursor issues
    }
  }, [editor, onChange, debouncedSync]); // Removed bindings from dependencies

  // Memoize slash menu items to prevent controller re-init
  const handleGetItems = useCallback(async (query: string) => {
    return filterSuggestionItems(
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
                        title: doc.title || "Untitled"
                      } as any
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
        } as any
      ],
      query
    );
  }, [editor, documentId, router]);

  return (
    <div className="relative group/editor">
      <BlockNoteView
        editable={editable}
        editor={editor}
        onChange={handleEditorChange}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        formattingToolbar={false}
      >
        <FormattingToolbarController />
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={handleGetItems}
        />
      </BlockNoteView>

      <SelectionToolbar
        documentId={documentId}
        onCreateConcept={handleCreateConcept}
        onLinkExisting={handleLinkExisting}
        onEnsureCanvas={() => {
          // Optionally open canvas panel
        }}
        onGenerateChart={(text, position) => {
          setExcalidrawGenPrompt(text);
          setExcalidrawGenPos(position);
          setShowExcalidrawGen(true);
        }}
      />

      <EditorBindingOverlay
        bindings={bindings}
        editor={editor}
        jumpToElement={jumpToElement}
        activeBlockId={highlightedBlockId || undefined}
      />

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
      <ExcalidrawGenerationModal
        isOpen={showExcalidrawGen}
        onClose={() => setShowExcalidrawGen(false)}
        initialPrompt={excalidrawGenPrompt}
        position={excalidrawGenPos}
        onInsert={(elements) => {
          if (editor) {
            // Insert Excalidraw Block
            const currentBlock = editor.getTextCursorPosition().block;
            editor.insertBlocks(
              [{
                type: "excalidraw",
                props: {
                  data: JSON.stringify(elements)
                } as any
              }],
              currentBlock,
              "after"
            );
          }
        }}
      />
    </div >
  );
};

// Export Memoized Component to prevent re-renders from Parent Layout updates
export const Editor = memo(EditorComponent, (prev, next) => {
  // CRITICAL: Only re-render if documentId changes. 
  // Ignore content/user/onChange updates to prevent focus loss during typing.
  return prev.documentId === next.documentId && prev.userId === next.userId;
});

export default Editor;
