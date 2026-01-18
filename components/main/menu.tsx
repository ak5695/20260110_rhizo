"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { archive } from "@/actions/documents";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash, Globe, Copy, Check } from "lucide-react";
import { useState } from "react";
import { update } from "@/actions/documents";
import { useOrigin } from "@/hooks/use-origin";

interface MenuProps {
  document: any;
}

export const Menu = ({ document: initialData }: MenuProps) => {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const origin = useOrigin();

  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const documentId = initialData.id;
  const url = `${origin}/preview/${documentId}`;

  const onArchive = () => {
    const promise = archive(documentId).then(() => {
      // Dispatch event to refresh document list immediately
      window.dispatchEvent(new CustomEvent("documents-changed"));
    });
    toast.promise(promise, {
      loading: "Moving to trash...",
      success: "Note moved to trash!",
      error: "Failed to archive note.",
    });
    router.push("/documents");
  };

  const onPublish = () => {
    setIsSubmitting(true);

    const promise = update({ id: documentId, isPublished: true }).finally(
      () => setIsSubmitting(false),
    );

    toast.promise(promise, {
      loading: "Publishing...",
      success: "Note published",
      error: "Failed to publish note.",
    });
  };

  const onUnpublish = () => {
    setIsSubmitting(true);

    const promise = update({ id: documentId, isPublished: false }).finally(
      () => setIsSubmitting(false),
    );

    toast.promise(promise, {
      loading: "Unpublishing...",
      success: "Note unpublished",
      error: "Failed to unpublish note.",
    });
  };

  const onCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1000);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-72"
        align="end"
        alignOffset={8}
        forceMount
      >
        <div className="p-3">
          {initialData.isPublished ? (
            <div className="space-y-4">
              <div className="flex items-center gap-x-2">
                <Globe className="text-sky-500 animate-pulse h-4 w-4" />
                <p className="text-xs font-medium text-sky-500">
                  This note is live on web.
                </p>
              </div>
              <div className="flex items-center text-muted-foreground mb-4">
                <input
                  className="flex-1 px-2 text-xs border rounded-l-md h-8 bg-muted truncate"
                  value={url}
                  disabled
                />
                <Button
                  onClick={onCopy}
                  disabled={copied}
                  className="h-8 rounded-l-none"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                size="sm"
                className="w-full text-xs"
                disabled={isSubmitting}
                onClick={onUnpublish}
              >
                Unpublish
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-2">
              <Globe className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium mb-1">Publish this note</p>
              <span className="text-xs text-muted-foreground mb-4 text-center">
                Share your work with others.
              </span>
              <Button
                disabled={isSubmitting}
                onClick={onPublish}
                className="w-full text-xs"
                size="sm"
              >
                Publish
              </Button>
            </div>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onArchive}>
          <Trash className="h-4 w-4 mr-2" /> Delete
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="text-xs text-muted-foreground p-2 text-center">
          Last edited by: {session?.user?.name}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

Menu.Skeleton = function MenuSkeleton() {
  return <Skeleton className="h-10 w-10" />;
};
