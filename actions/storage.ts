"use server"

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const R2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
});

export const getUploadUrl = async (key: string, type: string) => {
    const session = await auth.api.getSession({
        headers: await headers()
    });
    if (!session) throw new Error("Unauthorized");

    const putCommand = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        ContentType: type,
    });

    const url = await getSignedUrl(R2, putCommand, { expiresIn: 3600 });
    // Sanitize domain and ensure no trailing slash
    const domain = process.env.NEXT_PUBLIC_R2_DOMAIN?.replace(/\/$/, "");
    const publicUrl = domain
        ? `${domain}/${key}`
        : `https://${process.env.R2_BUCKET_NAME}.r2.dev/${key}`; // Fallback

    return { url, publicUrl };
}
