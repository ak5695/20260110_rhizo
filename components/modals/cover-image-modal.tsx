"use client";

import { useParams } from "next/navigation";
import { update } from "@/actions/documents";
import { getUploadUrl } from "@/actions/storage";
import { useCoverImage } from "@/hooks/use-cover-image";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { SingleImageDropzone } from "@/components/single-image-dropzone";
import { writeQueue } from "@/lib/write-queue";

export const CoverImageModal = () => {
  const params = useParams();
  const coverImage = useCoverImage();
  // removed edgestore

  const [file, setFile] = useState<File>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onClose = () => {
    setFile(undefined);
    setIsSubmitting(false);
    coverImage.onClose();
  };

  const onChange = async (file?: File) => {
    if (file) {
      setIsSubmitting(true);
      setFile(file);

      try {
        // Step 1: Get upload URL from server
        const key = `${Date.now()}-${file.name}`;
        const { url, publicUrl } = await getUploadUrl(key, file.type);

        // Step 2: Upload file to R2
        const uploadResponse = await fetch(url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.statusText}`);
        }

        // Step 3: Update document with cover image URL
        // This is immediate (no debounce) as it's a user-initiated action
        await update({
          id: params.documentId as string,
          coverImage: publicUrl,
        });

        onClose();
      } catch (error) {
        console.error("[CoverImageModal] Failed to upload cover image:", error);
        alert("Failed to upload cover image. Please try again.");
        setIsSubmitting(false);
      }
    }
  };

  return (
    <Dialog open={coverImage.isOpen} onOpenChange={coverImage.onClose}>
      <DialogContent>
        <DialogHeader>
          <h2 className="text-center text-lg font-semibold">Cover Image</h2>
        </DialogHeader>
        <SingleImageDropzone
          className="w-full outline-none"
          disabled={isSubmitting}
          value={file}
          onChange={onChange}
        />
      </DialogContent>
    </Dialog>
  );
};
