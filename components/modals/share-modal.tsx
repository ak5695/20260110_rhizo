"use client";

import { useState } from "react";
import { useDocumentStore } from "@/store/use-document-store";
import { update } from "@/actions/documents";
import { toast } from "sonner";
import { Check, Copy, Globe, Loader2 } from "lucide-react";
import { useOrigin } from "@/hooks/use-origin";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

interface ShareModalProps {
    documentId: string;
    initialPublished: boolean;
    children: React.ReactNode;
}

export const ShareModal = ({
    documentId,
    initialPublished,
    children
}: ShareModalProps) => {
    const origin = useOrigin();
    const [isPublished, setIsPublished] = useState(initialPublished);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const url = `${origin}/preview/${documentId}`;

    const onPublish = async () => {
        setLoading(true);
        try {
            await update({
                id: documentId,
                isPublished: true,
            });
            setIsPublished(true);
            toast.success("Document published");
        } catch {
            toast.error("Failed to publish");
        } finally {
            setLoading(false);
        }
    };

    const onUnpublish = async () => {
        setLoading(true);
        try {
            await update({
                id: documentId,
                isPublished: false,
            });
            setIsPublished(false);
            toast.success("Document unpublished");
        } catch {
            toast.error("Failed to unpublish");
        } finally {
            setLoading(false);
        }
    };

    const onCopy = () => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success("Link copied");

        setTimeout(() => {
            setCopied(false);
        }, 1000);
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Share this note</DialogTitle>
                </DialogHeader>
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-y-1">
                        <Label className="font-bold flex items-center gap-x-2">
                            <Globe className="h-4 w-4 text-sky-500" />
                            Publish to web
                        </Label>
                        <span className="text-xs text-muted-foreground">
                            Anyone with the link can view this document
                        </span>
                    </div>
                    <Switch
                        checked={isPublished}
                        onCheckedChange={isPublished ? onUnpublish : onPublish}
                        disabled={loading}
                    />
                </div>
                {isPublished && (
                    <div className="flex items-center gap-x-2 mt-4">
                        <Input value={url} className="flex-1 px-2 text-xs truncate" readOnly />
                        <Button size="sm" onClick={onCopy} disabled={copied} className="w-20">
                            {copied ? (
                                <Check className="h-4 w-4" />
                            ) : (
                                <Copy className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
