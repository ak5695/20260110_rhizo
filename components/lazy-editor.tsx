"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export const LazyEditor = dynamic(() => import("@/components/editor"), {
    ssr: false,
    loading: () => (
        <div className="space-y-4 pt-4">
            <Skeleton className="h-4 w-[80%]" />
            <Skeleton className="h-4 w-[40%]" />
            <Skeleton className="h-4 w-[60%]" />
        </div>
    )
});
