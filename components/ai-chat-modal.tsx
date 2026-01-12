"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles, Send, X, Copy, Check, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  position?: { top: number; left: number };
  onInsertText?: (text: string) => void;
  initialInput?: string;
}

export const AiChatModal = ({
  isOpen,
  onClose,
  position,
  onInsertText,
  initialInput = "",
}: AiChatModalProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Set initial input when modal opens with initialInput
  useEffect(() => {
    if (isOpen && initialInput) {
      setInput(initialInput);
    }
  }, [isOpen, initialInput]);

  // Focus input when modal opens and move cursor to end
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Move cursor to end
          inputRef.current.setSelectionRange(
            inputRef.current.value.length,
            inputRef.current.value.length
          );
        }
      }, 100);
    }
  }, [isOpen]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Keep messages for context, but reset input
      setInput("");
    }
  }, [isOpen]);

  const onCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();

    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmedInput,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Prepare messages for API
      const apiMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      // Add placeholder assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
      };
      setMessages((prev) => [...prev, assistantMessage]);

      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;

        // Update the assistant message with accumulated content
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? { ...m, content: fullContent }
              : m
          )
        );
      }
    } catch (error) {
      console.error("Chat error:", error);
      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, messages]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-start justify-center pt-20 bg-black/20">
      <div
        ref={modalRef}
        className={cn(
          "bg-background/60 backdrop-blur-xl rounded-lg shadow-2xl w-[600px] max-h-[500px] flex flex-col",
          "border border-border",
          "animate-in fade-in slide-in-from-top-2 duration-200"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Sparkles className="w-5 h-5 text-rose-600" />
          <h3 className="font-semibold text-foreground">
            AI Assistant
          </h3>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Press ESC to close</span>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <Sparkles className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Ask me anything...</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-4 py-2 relative group",
                    message.role === "user"
                      ? "bg-rose-600 text-white"
                      : "bg-muted text-foreground"
                  )}
                >
                  <div className="flex flex-col gap-1">
                    <div className="text-sm prose dark:prose-invert prose-sm max-w-none">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                          li: ({ children }) => <li className="mb-1">{children}</li>,
                          code: ({ children }) => <code className="bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 font-mono text-xs">{children}</code>,
                          pre: ({ children }) => <pre className="bg-black/10 dark:bg-white/10 rounded p-2 mb-2 overflow-x-auto font-mono text-xs">{children}</pre>,
                          h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-bold mb-2">{children}</h3>,
                        }}
                      >
                        {message.content || (isLoading && message.role === "assistant" ? "..." : "")}
                      </ReactMarkdown>
                    </div>
                  </div>

                  {/* Assistant Action Buttons */}
                  {message.role === "assistant" && message.content && !isLoading && (
                    <div className="flex items-center gap-x-2 mt-2 pt-2 border-t border-black/5 dark:border-white/5">
                      <button
                        onClick={() => onCopy(message.content, message.id)}
                        className="flex items-center gap-1 px-1.5 py-1 rounded bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition"
                        title="Copy to clipboard"
                      >
                        {copiedId === message.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span className="text-[10px] font-medium">{copiedId === message.id ? "Copied" : "Copy"}</span>
                      </button>
                      <button
                        onClick={() => {
                          if (onInsertText) {
                            onInsertText(message.content);
                            onClose();
                          }
                        }}
                        className="flex items-center gap-1 px-1.5 py-1 rounded bg-black/5 dark:bg-white/5 hover:bg-rose-500/10 hover:text-rose-600 transition"
                        title="Insert to editor"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-medium">Insert</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3 justify-start">
              <div className="bg-muted rounded-lg px-4 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-border p-4"
        >
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask AI to write, edit, or continue..."
              className="outline-none flex-1 px-3 py-2 text-sm border border-neutral-300 dark:border-white/10 rounded-md bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500"
              disabled={isLoading}
              autoComplete="off"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !input.trim()}
              className="bg-transparent hover:bg-rose-700 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-black dark:text-white " />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
