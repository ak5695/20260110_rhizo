"use client";

import { useCachedSession } from "@/hooks/use-cached-session";
import { Button } from "@/components/ui/button";
import { Copy, FileInput, LogIn } from "lucide-react";
import Link from "next/link";
import { duplicateDocument } from "@/actions/documents";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface PublicNavbarProps {
    document: any;
}

export const PublicNavbar = ({ document }: PublicNavbarProps) => {
    const { data: session } = useCachedSession();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const onDuplicate = async () => {
        if (!session) {
            router.push("/sign-in");
            return;
        }

        setLoading(true);
        const promise = duplicateDocument(document.id);

        toast.promise(promise, {
            loading: "Duplicating document...",
            success: (data) => {
                router.push(`/documents/${data.id}`);
                return "Document duplicated to your workspace";
            },
            error: "Failed to duplicate document",
            finally: () => setLoading(false)
        });
    };

    return (
        <nav className="fixed top-0 z-50 w-full h-14 bg-background border-b flex items-center justify-between px-4">
            <div className="flex items-center gap-x-2">
                <div className="font-semibold text-lg">Rhizo</div>
                <div className="h-4 w-[1px] bg-muted-foreground/20 mx-2" />
                <div className="flex items-center gap-x-2">
                    {document.icon && <p>{document.icon}</p>}
                    <p className="font-medium truncate max-w-[200px]">{document.title}</p>
                </div>
            </div>
            <div className="flex items-center gap-x-2">
                <div className="flex items-center gap-x-2">
                    {!session && (
                        <Button size="sm" variant="ghost" asChild>
                            <Link href="/sign-in">
                                Log in
                            </Link>
                        </Button>
                    )}
                    <Button size="sm" onClick={onDuplicate} disabled={loading}>
                        <FileInput className="h-4 w-4 mr-2" />
                        {session ? "Duplicate" : "Save to Rhizo"}
                    </Button>
                </div>
            </div>
        </nav>
    );
}
