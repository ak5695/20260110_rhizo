import { useCallback, useRef } from "react";
import { ExcalidrawImperativeAPI, BinaryFileData } from "@excalidraw/excalidraw/types";
import { getUploadUrl } from "@/actions/storage";
import { saveCanvasFile } from "@/actions/canvas";
import { toast } from "sonner"; // Assuming sonner is used

export const useCanvasFilePersistence = (
    canvasId: string,
    excalidrawAPI: ExcalidrawImperativeAPI | null
) => {
    // Track files being uploaded to prevent duplicate uploads
    const uploadingFiles = useRef<Set<string>>(new Set());

    // Function to process files from Excalidraw state
    const syncFiles = useCallback(async (files: Record<string, BinaryFileData>) => {
        if (!excalidrawAPI || !canvasId) return;

        for (const fileId in files) {
            const file = files[fileId];

            // Check if it's a local Data URL (schema: "data:image/...")
            // and not already being uploaded
            if (file.dataURL.startsWith("data:") && !uploadingFiles.current.has(fileId)) {

                // Mark as uploading
                uploadingFiles.current.add(fileId);

                console.log(`[CanvasFilePersistence] Detected new local file: ${fileId}, uploading...`);
                const toastId = toast.loading("Uploading image...", { id: `upload-${fileId}` });

                try {
                    // 1. Convert Data URL to Blob
                    const res = await fetch(file.dataURL);
                    const blob = await res.blob();
                    const fileObj = new File([blob], fileId, { type: file.mimeType });

                    // 2. Get Upload URL
                    const { url, publicUrl } = await getUploadUrl(fileId, file.mimeType);

                    // 3. Upload to R2
                    await fetch(url, {
                        method: "PUT",
                        body: fileObj,
                        headers: {
                            "Content-Type": file.mimeType,
                        },
                    });

                    // 4. Update DB
                    // We construct the updated file object with the public URL
                    const remoteFile: BinaryFileData = {
                        ...file,
                        dataURL: publicUrl as any, // Cast for type compatibility
                    };

                    await saveCanvasFile(canvasId, remoteFile);

                    // 5. Update Excalidraw State (Replace Data URL with Public URL)
                    excalidrawAPI.addFiles([remoteFile]);

                    toast.success("Image uploaded", { id: toastId });
                    console.log(`[CanvasFilePersistence] Upload complete: ${publicUrl}`);

                } catch (error) {
                    console.error(`[CanvasFilePersistence] Upload failed for ${fileId}:`, error);
                    toast.error("Image upload failed", { id: toastId });
                    // Remove from uploading set so we can retry later if needed
                    uploadingFiles.current.delete(fileId);
                }
            }
        }
    }, [canvasId, excalidrawAPI]);

    return {
        syncFiles
    };
};
