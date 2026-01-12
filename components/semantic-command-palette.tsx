"use client";

import {
    Link,
    PlusCircle,
    CheckCircle2,
    XCircle,
    Zap,
    Search,
    ShieldCheck
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface SemanticCommandPaletteProps {
    selectionText: string;
    onAction: (action: string, data?: any) => Promise<void>;
    existingAnchor?: {
        id: string;
        title: string;
        provenance: string;
    };
}

export const SemanticCommandPalette = ({
    selectionText,
    onAction,
    existingAnchor
}: SemanticCommandPaletteProps) => {
    const [isLinking, setIsLinking] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState(existingAnchor?.title || "");
    const [searchQuery, setSearchQuery] = useState("");

    if (existingAnchor) {
        // 仲裁模式: 处理 AI 建议
        return (
            <div className="flex flex-col p-2 bg-background/95 backdrop-blur-2xl border border-primary/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] min-w-[240px] animate-in fade-in zoom-in duration-300 ring-1 ring-white/10">
                <div className="flex items-center gap-3 px-2.5 py-2.5 mb-2 border-b border-white/5">
                    <div className="p-1.5 rounded-lg bg-primary/10 shadow-inner">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                    </div>
                    {!isEditingName ? (
                        <div className="flex flex-col overflow-hidden flex-1">
                            <span className="text-xs font-bold truncate leading-none mb-1">
                                {existingAnchor.title}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <span className="p-[2px] rounded-full bg-amber-500 animate-pulse" />
                                <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-black">
                                    AI Suggestion
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1">
                            <input
                                autoFocus
                                value={editNameValue}
                                onChange={(e) => setEditNameValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        onAction("rename", { nodeId: existingAnchor.id, newTitle: editNameValue });
                                        setIsEditingName(false);
                                    }
                                }}
                                className="w-full bg-muted/50 border-none rounded-md px-2 py-1 text-xs focus:ring-1 focus:ring-primary outline-none"
                            />
                        </div>
                    )}
                </div>

                <div className="space-y-1">
                    {!isEditingName ? (
                        <>
                            <button
                                onClick={() => onAction("accept", { id: existingAnchor.id })}
                                className="flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold hover:bg-emerald-500/10 hover:text-emerald-400 rounded-xl transition-all group/btn"
                            >
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 group-hover/btn:scale-110 transition-transform" />
                                <span>Accept & Validate</span>
                            </button>

                            <button
                                onClick={() => onAction("reject", { id: existingAnchor.id })}
                                className="flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold hover:bg-rose-500/10 hover:text-rose-400 rounded-xl transition-all group/btn"
                            >
                                <XCircle className="w-4 h-4 text-rose-500 group-hover/btn:scale-110 transition-transform" />
                                <span>Reject & Block AI</span>
                            </button>

                            <button
                                onClick={() => setIsEditingName(true)}
                                className="flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold hover:bg-primary/10 hover:text-primary rounded-xl transition-all group/btn"
                            >
                                <Zap className="w-4 h-4 text-amber-500 group-hover/btn:scale-110 transition-transform" />
                                <span>Edit Name</span>
                            </button>
                        </>
                    ) : (
                        <div className="flex gap-1 p-1">
                            <button
                                onClick={() => {
                                    onAction("rename", { nodeId: existingAnchor.id, newTitle: editNameValue });
                                    setIsEditingName(false);
                                }}
                                className="flex-1 py-1.5 text-[10px] bg-primary text-primary-foreground rounded-lg font-bold"
                            >
                                Save
                            </button>
                            <button
                                onClick={() => setIsEditingName(false)}
                                className="px-3 py-1.5 text-[10px] bg-muted rounded-lg"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // 创建/关联模式
    return (
        <div className="flex flex-col p-1.5 bg-background/90 backdrop-blur-3xl border border-white/10 rounded-[24px] shadow-[0_30px_60px_rgba(0,0,0,0.6)] min-w-[260px] animate-in fade-in slide-in-from-bottom-4 duration-500 ring-1 ring-white/5">
            {!isLinking ? (
                <div className="space-y-1">
                    <div className="px-3.5 py-3 mb-1.5 flex items-center justify-between border-b border-white/5">
                        <div className="flex items-center gap-2.5">
                            <div className="relative">
                                <Zap className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                                <div className="absolute inset-0 blur-sm bg-amber-400/50 animate-pulse rounded-full" />
                            </div>
                            <span className="text-[10px] uppercase font-black tracking-[0.25em] text-foreground/70">
                                Sovereignty Entry
                            </span>
                        </div>
                        <div className="flex gap-1">
                            <div className="w-1 h-1 rounded-full bg-white/20" />
                            <div className="w-1 h-1 rounded-full bg-white/10" />
                        </div>
                    </div>

                    <button
                        onClick={() => onAction("create", { title: selectionText })}
                        className="flex items-center gap-3 w-full px-3 py-2 text-sm hover:bg-primary/10 rounded-lg transition-all group"
                    >
                        <div className="p-1.5 rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            <PlusCircle className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="font-medium">Create Concept</span>
                            <span className="text-[10px] text-muted-foreground">Define "{selectionText.slice(0, 15)}..."</span>
                        </div>
                    </button>

                    <button
                        onClick={() => setIsLinking(true)}
                        className="flex items-center gap-3 w-full px-3 py-2 text-sm hover:bg-primary/10 rounded-lg transition-all group"
                    >
                        <div className="p-1.5 rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            <Link className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="font-medium">Link Existing</span>
                            <span className="text-[10px] text-muted-foreground">Connect to knowledge graph</span>
                        </div>
                    </button>
                </div>
            ) : (
                <div className="space-y-3 p-1">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                        <input
                            autoFocus
                            placeholder="Search concepts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-muted/50 border-none rounded-md pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                    </div>
                    <div className="max-h-[160px] overflow-y-auto custom-scrollbar">
                        {/* Search results would go here */}
                        <div className="text-[10px] text-center text-muted-foreground py-4 italic">
                            Search result integration pending...
                        </div>
                    </div>
                    <button
                        onClick={() => setIsLinking(false)}
                        className="w-full text-[10px] text-muted-foreground hover:text-foreground text-center"
                    >
                        Back to options
                    </button>
                </div>
            )}
        </div>
    );
};
