"use client";

import { useEffect } from "react";
import { useQaStore, QuestionItem } from "@/store/use-qa-store";
import { cn } from "@/lib/utils";
import { X, Sparkles, Check, Trash2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

interface QaListProps {
    onClose: () => void;
    className?: string;
    onAsk: (question: string, autoRun?: boolean) => void;
}

export const QaList = ({ onClose, className, onAsk }: QaListProps) => {
    const { items, removeItem, markAsAsked, markAsUnasked, hydrate } = useQaStore();

    // Hydrate from DB on mount
    useEffect(() => {
        hydrate();
    }, [hydrate]);

    const unaskedItems = items.filter((item) => item.status === "unasked").sort((a, b) => b.createdAt - a.createdAt);
    const askedItems = items.filter((item) => item.status === "asked").sort((a, b) => b.createdAt - a.createdAt);

    const handleAsk = (item: QuestionItem, type: "what" | "why" | "how" | "custom") => {
        let prompt = "";
        switch (type) {
            case "what":
                prompt = `什么是 "${item.text}"?`;
                break;
            case "why":
                prompt = `为什么 "${item.text}" 重要?`;
                break;
            case "how":
                prompt = `如何理解 "${item.text}"?`;
                break;
            case "custom":
                prompt = item.text;
                break;
        }
        // Pass false for autoRun to just prefill the input
        onAsk(prompt, false);

        markAsAsked(item.id);
    };

    return (
        <div className={cn("flex flex-col h-full bg-background border-l border-border", className)}>
            <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-orange-500" />
                    <h3 className="font-semibold text-foreground">Q&A Checklist</h3>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                    <X className="w-4 h-4" />
                </Button>
            </div>

            <Tabs defaultValue="unasked" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 pt-4">
                    <TabsList className="w-full grid grid-cols-2">
                        <TabsTrigger value="unasked">To Ask ({unaskedItems.length})</TabsTrigger>
                        <TabsTrigger value="asked">Completed ({askedItems.length})</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="unasked" className="flex-1 overflow-hidden data-[state=active]:flex flex-col mt-4">
                    {/* Manual Add Input */}
                    <div className="px-4 py-2">
                        <div className="relative">
                            <input
                                placeholder="Edit question..."
                                ref={(input) => {
                                    if (input) {
                                        // Move cursor to end
                                        input.setSelectionRange(input.value.length, input.value.length);
                                        input.focus();
                                    }
                                }}
                                className="w-full text-xs pl-3 pr-8 py-2 bg-muted/50 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        const val = (e.target as HTMLInputElement).value.trim();
                                        if (val) {
                                            import("@/store/use-qa-store").then(({ useQaStore }) => {
                                                useQaStore.getState().addItem(val);
                                            });
                                            (e.target as HTMLInputElement).value = "";
                                        }
                                    }
                                }}
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                <HelpCircle className="w-3 h-3 text-muted-foreground" />
                            </div>
                        </div>
                    </div>

                    <ScrollArea className="flex-1 px-4 pb-4">
                        {unaskedItems.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8 text-sm">
                                No questions pending. <br /> Select text and click "Ask Later" to add here.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {unaskedItems.map((item) => (
                                    <div key={item.id} className="bg-muted/30 rounded-lg p-3 border border-border/50 group hover:border-orange-500/30 transition-all">
                                        <p className="text-sm font-medium line-clamp-3 mb-2 text-foreground/90">
                                            "{item.text}"
                                        </p>
                                        <div className="flex items-center justify-between gap-2 mt-2">
                                            <div className="flex gap-1 flex-wrap">
                                                {(["what", "why", "how"] as const).map((type) => (
                                                    <Button
                                                        key={type}
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 text-[10px] px-2 capitalize hover:text-orange-600 hover:border-orange-300 bg-background"
                                                        onClick={() => handleAsk(item, type)}
                                                    >
                                                        {type === "what" ? "什么是" : type === "why" ? "为什么" : "怎么办"}?
                                                    </Button>
                                                ))}
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-6 text-[10px] px-2 capitalize hover:text-orange-600 hover:border-orange-300 bg-background"
                                                    onClick={() => {
                                                        handleAsk(item, "custom");
                                                    }}
                                                >
                                                    直接问
                                                </Button>
                                            </div>
                                            <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                    onClick={() => removeItem(item.id)}
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-2 text-right">
                                            Added {formatDistanceToNow(item.createdAt)} ago
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="asked" className="flex-1 overflow-hidden data-[state=active]:flex flex-col mt-2">
                    <ScrollArea className="flex-1 px-4 pb-4">
                        {askedItems.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8 text-sm">
                                No completed questions yet.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {askedItems.map((item) => (
                                    <div key={item.id} className="bg-background rounded-lg p-3 border border-border/50 shadow-sm transition-all hover:border-green-500/30 group">
                                        <div className="flex items-start justify-between">
                                            <p className="text-sm font-medium text-foreground/80">
                                                {item.text}
                                            </p>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6 -mt-1 -mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => markAsUnasked(item.id)}
                                                title="Mark as unasked"
                                            >
                                                <Check className="w-3.5 h-3.5 text-green-500" />
                                            </Button>
                                        </div>
                                        <div className="flex justify-end mt-2">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                onClick={() => removeItem(item.id)}
                                                title="Delete"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </TabsContent>
            </Tabs>
        </div>
    );
};
