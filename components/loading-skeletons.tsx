import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

export const EditorSkeleton = () => {
    return (
        <div className="relative h-full overflow-hidden bg-background dark:bg-[#1F1F1F]">
            <div className="absolute left-0 top-0 bottom-0 right-0 flex flex-col overflow-hidden">
                {/* Navbar Placeholder */}
                <div className="h-12 border-b bg-background/50 flex items-center px-4">
                    <Skeleton className="h-5 w-32" />
                </div>

                {/* Editor Content Placeholder */}
                <div className="flex-1 overflow-y-auto">
                    <div className="pb-40">
                        {/* Cover Image Skeleton */}
                        <div className="h-[35vh] w-full bg-muted/30 animate-pulse relative group">
                            <div className="absolute bottom-4 right-4 hidden group-hover:block">
                                <Skeleton className="h-6 w-24" />
                            </div>
                        </div>

                        {/* Title & Blocks */}
                        <div className="md:max-w-3xl lg:max-w-4xl mx-auto mt-10 space-y-8 px-8">
                            <Skeleton className="h-14 w-[75%]" /> {/* Title */}
                            <div className="space-y-4">
                                <Skeleton className="h-4 w-[90%]" />
                                <Skeleton className="h-4 w-[85%]" />
                                <Skeleton className="h-4 w-[40%]" />
                            </div>
                            <div className="space-y-4 pt-4">
                                <Skeleton className="h-4 w-[95%]" />
                                <Skeleton className="h-4 w-[80%]" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const CanvasSkeleton = () => {
    return (
        <div className="h-full w-full bg-muted/5 flex flex-col relative overflow-hidden">
            {/* Canvas Toolbar Placeholder */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 h-12 w-96 bg-background/80 rounded-lg border shadow-sm flex items-center justify-center gap-4 px-4">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
                <div className="w-px h-6 bg-border mx-2" />
                <Skeleton className="h-8 w-8 rounded-md" />
            </div>

            {/* Center Loader */}
            <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-y-3">
                    <Loader2 className="h-8 w-8 text-muted-foreground/40 animate-spin" />
                    <p className="text-sm text-muted-foreground/50 font-medium">Loading Canvas...</p>
                </div>
            </div>
        </div>
    );
};

export const SplitSkeleton = () => {
    return (
        <div className="h-full w-full flex bg-background dark:bg-[#1F1F1F] overflow-hidden">
            {/* Left: Editor (50%) */}
            <div className="flex-1 border-r border-border/40 hidden md:block">
                <EditorSkeleton />
            </div>

            {/* Right: Canvas (50%) */}
            <div className="flex-1 bg-muted/5">
                <CanvasSkeleton />
            </div>
        </div>
    );
};
