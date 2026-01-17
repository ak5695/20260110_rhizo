"use server"

import { db } from "@/db"
import { documents } from "@/db/schema"
import { auth } from "@/lib/auth"
import { eq, and, desc, asc, ne, isNull } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import {
    safeUpdateDocument,
    safeCreateDocument,
    withRetry,
    OptimisticLockError,
    getDocumentWithVersion,
} from "@/lib/safe-update"
import { documentCache } from "@/lib/cache/document-cache"

const getUser = async () => {
    try {
        const headersList = await headers();
        const session = await auth.api.getSession({
            headers: headersList
        });
        return session?.user;
    } catch (e) {
        console.error("[getUser] Auth check failed:", e);
        return null;
    }
}

export const archive = async (id: string) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")

    // Get document with version for optimistic locking
    const docWithVersion = await getDocumentWithVersion(id, user.id)
    if (!docWithVersion) throw new Error("Not found")

    // Recursive archive (no transaction support in neon-http)
    const recursiveArchive = async (documentId: string) => {
        const children = await db.select().from(documents).where(
            and(eq(documents.userId, user.id), eq(documents.parentDocumentId, documentId))
        )

        for (const child of children) {
            await db.update(documents).set({
                isArchived: true,
                version: child.version + 1,
                lastModifiedBy: user.id,
                updatedAt: new Date()
            }).where(eq(documents.id, child.id))

            // Invalidate child from cache
            await documentCache.invalidate(child.id)

            await recursiveArchive(child.id)
        }
    }

    // Archive parent document
    const [archived] = await db.update(documents).set({
        isArchived: true,
        version: docWithVersion.version + 1,
        lastModifiedBy: user.id,
        updatedAt: new Date()
    }).where(eq(documents.id, id)).returning()

    // Notion-like: Remove from parent content if it was a subpage
    if (archived.parentDocumentId) {
        try {
            const parent = await getDocumentWithVersion(archived.parentDocumentId, user.id);
            if (parent && parent.document.content) {
                let content = JSON.parse(parent.document.content);
                if (Array.isArray(content)) {
                    const newContent = content.filter((block: any) =>
                        !(block.type === "page" && block.props?.pageId === id)
                    );

                    if (newContent.length !== content.length) {
                        await safeUpdateDocument({
                            documentId: parent.document.id,
                            updates: { content: JSON.stringify(newContent) },
                            options: {
                                expectedVersion: parent.version,
                                userId: user.id,
                            },
                        });
                        await documentCache.invalidate(parent.document.id);
                    }
                }
            }
        } catch (e) {
            console.error("[NotionSync] Parent unlink failed:", e);
        }
    }

    // Archive all children
    await recursiveArchive(id)

    // Invalidate from cache
    await documentCache.invalidate(id)

    revalidatePath("/documents")
    return archived
}

export const getSidebar = async (parentDocumentId?: string) => {
    try {
        const user = await getUser()
        if (!user) return []

        // Basic UUID format check if parentDocumentId is provided
        if (parentDocumentId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parentDocumentId)) {
            console.warn("[getSidebar] Invalid parentDocumentId format:", parentDocumentId);
            return [];
        }

        const data = await db.select().from(documents)
            .where(
                and(
                    eq(documents.userId, user.id),
                    parentDocumentId ? eq(documents.parentDocumentId, parentDocumentId) : isNull(documents.parentDocumentId),
                    eq(documents.isArchived, false)
                )
            )
            .orderBy(desc(documents.createdAt))

        return data
    } catch (error) {
        console.error("[getSidebar] Failed to fetch sidebar:", error);
        return [];
    }
}

export const create = async (args: { id?: string, title: string, parentDocumentId?: string }) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")

    console.log("[DOCUMENTS-ACTION] Attempting to call safeCreateDocument with:", args.title);
    console.log("[DOCUMENTS-ACTION] safeCreateDocument type:", typeof safeCreateDocument);

    const newDoc = await safeCreateDocument({
        id: args.id,
        title: args.title,
        userId: user.id,
        parentDocumentId: args.parentDocumentId,
    });

    console.log("[DOCUMENTS-ACTION] Successfully created document:", newDoc.id);

    // ⚡ Notion-like Performance: Async parent update & caching (non-blocking)
    // 将所有非核心任务放到异步队列，且不阻塞主响应
    (async () => {
        try {
            if (args.parentDocumentId) {
                const parent = await getDocumentWithVersion(args.parentDocumentId!, user.id);
                if (parent) {
                    let content: any[] = [];
                    try {
                        content = parent.document.content ? JSON.parse(parent.document.content) : [];
                    } catch (e) { content = []; }

                    const pageBlock = {
                        id: Math.random().toString(36).substring(2, 11),
                        type: "page",
                        props: {
                            backgroundColor: "default",
                            textColor: "default",
                            textAlignment: "left",
                            pageId: newDoc.id,
                            title: args.title
                        },
                        children: []
                    };

                    content.push(pageBlock);

                    await safeUpdateDocument({
                        documentId: parent.document.id,
                        updates: { content: JSON.stringify(content) },
                        options: {
                            expectedVersion: parent.version,
                            userId: user.id
                        }
                    });

                    await documentCache.invalidate(parent.document.id);
                }
            }
        } catch (error) {
            console.error("[NotionSync] Background maintenance failed:", error);
        }
    })();

    // ✅ 立即返回新文档，毫秒级响应
    return newDoc
}

export const getTrash = async () => {
    const user = await getUser()
    if (!user) return []

    const data = await db.select().from(documents)
        .where(
            and(
                eq(documents.userId, user.id),
                eq(documents.isArchived, true)
            )
        )
        .orderBy(desc(documents.createdAt))

    return data
}

export const restore = async (id: string) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")

    const existingDocument = await db.query.documents.findFirst({
        where: and(eq(documents.id, id), eq(documents.userId, user.id))
    })
    if (!existingDocument) throw new Error("Not found")

    // Recursive restore (no transaction support in neon-http)
    const recursiveRestore = async (documentId: string) => {
        const children = await db.select().from(documents).where(
            and(eq(documents.userId, user.id), eq(documents.parentDocumentId, documentId))
        )

        for (const child of children) {
            await db.update(documents).set({
                isArchived: false,
                version: child.version + 1,
                lastModifiedBy: user.id,
                updatedAt: new Date()
            }).where(eq(documents.id, child.id))

            // Invalidate child from cache
            await documentCache.invalidate(child.id)

            await recursiveRestore(child.id)
        }
    }

    // Check if parent is archived, if so, orphan this document
    let parentId = existingDocument.parentDocumentId
    if (parentId) {
        const parent = await db.query.documents.findFirst({
            where: eq(documents.id, parentId)
        })
        if (parent?.isArchived) {
            parentId = null
        }
    }

    // Restore parent document
    const [restored] = await db.update(documents).set({
        isArchived: false,
        parentDocumentId: parentId,
        version: existingDocument.version + 1,
        lastModifiedBy: user.id,
        updatedAt: new Date()
    }).where(eq(documents.id, id)).returning()

    // Restore all children
    await recursiveRestore(id)

    // Invalidate from cache
    await documentCache.invalidate(id)

    revalidatePath("/documents")
    return restored
}

export const remove = async (id: string) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")

    // Check auth
    const existing = await db.query.documents.findFirst({
        where: and(eq(documents.id, id), eq(documents.userId, user.id))
    })
    if (!existing) throw new Error("Not found")

    const [deleted] = await db.delete(documents).where(eq(documents.id, id)).returning()

    // Notion-like: Remove from parent content on permanent delete
    if (deleted.parentDocumentId) {
        try {
            const parent = await getDocumentWithVersion(deleted.parentDocumentId, user.id);
            if (parent && parent.document.content) {
                let content = JSON.parse(parent.document.content);
                if (Array.isArray(content)) {
                    const newContent = content.filter((block: any) =>
                        !(block.type === "page" && block.props?.pageId === id)
                    );
                    if (newContent.length !== content.length) {
                        await safeUpdateDocument({
                            documentId: parent.document.id,
                            updates: { content: JSON.stringify(newContent) },
                            options: {
                                expectedVersion: parent.version,
                                userId: user.id
                            }
                        });
                        await documentCache.invalidate(parent.document.id);
                    }
                }
            }
        } catch (e) {
            console.error("[NotionSync] Permanent unlink failed:", e);
        }
    }

    // Invalidate from cache after deletion
    await documentCache.invalidate(id)

    revalidatePath("/documents")
    return deleted
}

export const getSearch = async () => {
    const user = await getUser()
    if (!user) return []

    const data = await db.select().from(documents)
        .where(
            and(
                eq(documents.userId, user.id),
                eq(documents.isArchived, false)
            )
        )
        .orderBy(desc(documents.createdAt))
    return data
}

export const getById = async (documentId: string) => {
    try {
        // Basic UUID format check
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(documentId)) {
            return null;
        }

        const user = await getUser()
        // We fetch document first to check published status
        const document = await db.query.documents.findFirst({
            where: eq(documents.id, documentId)
        })

        if (!document) return null;

        if (document.isPublished && !document.isArchived) {
            return document
        }

        if (!user) throw new Error("Not authenticated")

        if (document.userId !== user.id) {
            throw new Error("Unauthorized")
        }

        return document
    } catch (error) {
        console.error("[getById] Failed to fetch document:", error);
        return null;
    }
}

export const update = async (args: {
    id: string,
    title?: string,
    content?: string,
    coverImage?: string,
    icon?: string,
    isPublished?: boolean,
    version?: number
}) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")

    const { id, version, ...updates } = args

    let currentAttempt = 0;
    return await withRetry(async () => {
        currentAttempt++;

        // Get the latest current version from DB on each attempt
        const docWithVersion = await getDocumentWithVersion(id, user.id)
        if (!docWithVersion) throw new Error("Not found")

        // Self-Healing Logic: 
        // On the first attempt, we use the client's provided version (strict check).
        // On subsequent retries, we use the DB's current version to allow the update to proceed
        // if the conflict was just a race condition from the same user's actions.
        const expectedVersion = (currentAttempt === 1 && version !== undefined)
            ? version
            : docWithVersion.version;

        console.log(`[Update] Attempt ${currentAttempt}: doc=${id} expected=${expectedVersion} actual=${docWithVersion.version}`);

        // Use safe update with optimistic locking
        const result = await safeUpdateDocument({
            documentId: id,
            updates,
            options: {
                expectedVersion,
                userId: user.id,
            },
        })

        // Invalidate cache after update
        await documentCache.invalidate(id)

        // 如果更新了内容，则同步块数据到结构化表（语义引擎依赖）
        if (updates.content) {
            const { syncBlocks } = await import("@/lib/services/semantic/block-sync");
            await syncBlocks(id, updates.content);
        }

        // ⚡ Performance Optimization:
        const affectsMetadata =
            updates.title !== undefined ||
            updates.icon !== undefined ||
            updates.coverImage !== undefined ||
            updates.isPublished !== undefined;

        // DEBUG LOGGING
        if (affectsMetadata) {
            console.log("[UpdateAction] Triggering revalidatePath due to metadata change:",
                Object.keys(updates).filter(k =>
                    ['title', 'icon', 'coverImage', 'isPublished'].includes(k)
                )
            );
        } else {
            // console.log("[UpdateAction] Skipping revalidatePath (Content only)");
        }

        if (affectsMetadata) {
            revalidatePath(`/documents/${id}`)
            revalidatePath("/documents")
        }

        return result.data
    }, { maxAttempts: 3, baseDelay: 200 })
}

export const removeIcon = async (id: string) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")

    const docWithVersion = await getDocumentWithVersion(id, user.id)
    if (!docWithVersion) throw new Error("Not found")

    return update({ id, icon: null as any, version: docWithVersion.version })
}

export const removeCoverImage = async (id: string) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")

    const docWithVersion = await getDocumentWithVersion(id, user.id)
    if (!docWithVersion) throw new Error("Not found")

    return update({ id, coverImage: null as any, version: docWithVersion.version })
}
