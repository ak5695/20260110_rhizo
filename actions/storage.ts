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
    // Assuming custom domain or public R2 dev URL
    const publicUrl = process.env.NEXT_PUBLIC_R2_DOMAIN
        ? `${process.env.NEXT_PUBLIC_R2_DOMAIN}/${key}`
        : `https://${process.env.R2_BUCKET_NAME}.r2.dev/${key}`; // Fallback

    return { url, publicUrl };
}
