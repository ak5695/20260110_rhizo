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
    const session = await auth.api.getSession({
        headers: await headers()
    })
    return session?.user
}

export const archive = async (id: string) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")

    // Get document with version for optimistic locking
    const docWithVersion = await getDocumentWithVersion(id, user.id)
    if (!docWithVersion) throw new Error("Not found")

    // Use transaction for atomic recursive archive
    const archived = await db.transaction(async (tx) => {
        const recursiveArchive = async (documentId: string) => {
            const children = await tx.select().from(documents).where(
                and(eq(documents.userId, user.id), eq(documents.parentDocumentId, documentId))
            )

            for (const child of children) {
                await tx.update(documents).set({
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
        const [archivedDoc] = await tx.update(documents).set({
            isArchived: true,
            version: docWithVersion.version + 1,
            lastModifiedBy: user.id,
            updatedAt: new Date()
        }).where(eq(documents.id, id)).returning()

        // Archive all children
        await recursiveArchive(id)

        return archivedDoc
    })

    // Invalidate from cache
    await documentCache.invalidate(id)

    revalidatePath("/documents")
    return archived
}

export const getSidebar = async (parentDocumentId?: string) => {
    const user = await getUser()
    if (!user) return []

    // parentDocumentId is undefined for root documents
    // In DB, root documents have parentDocumentId as null

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
}

export const create = async (args: { title: string, parentDocumentId?: string }) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")

    // Use safe create with audit trail
    const newDoc = await safeCreateDocument({
        title: args.title,
        userId: user.id,
        parentDocumentId: args.parentDocumentId,
    })

    revalidatePath("/documents")
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

    // Use transaction for atomic recursive restore
    const restored = await db.transaction(async (tx) => {
        const recursiveRestore = async (documentId: string) => {
            const children = await tx.select().from(documents).where(
                and(eq(documents.userId, user.id), eq(documents.parentDocumentId, documentId))
            )

            for (const child of children) {
                await tx.update(documents).set({
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
            const parent = await tx.query.documents.findFirst({
                where: eq(documents.id, parentId)
            })
            if (parent?.isArchived) {
                parentId = null
            }
        }

        // Restore parent document
        const [restoredDoc] = await tx.update(documents).set({
            isArchived: false,
            parentDocumentId: parentId,
            version: existingDocument.version + 1,
            lastModifiedBy: user.id,
            updatedAt: new Date()
        }).where(eq(documents.id, id)).returning()

        // Restore all children
        await recursiveRestore(id)

        return restoredDoc
    })

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
    const user = await getUser()
    // We fetch document first to check published status
    const document = await db.query.documents.findFirst({
        where: eq(documents.id, documentId)
    })

    if (!document) throw new Error("Not found")

    if (document.isPublished && !document.isArchived) {
        return document
    }

    if (!user) throw new Error("Not authenticated")

    if (document.userId !== user.id) {
        throw new Error("Unauthorized")
    }

    return document
}

export const update = async (args: {
    id: string,
    title?: string,
    content?: string,
    coverImage?: string,
    icon?: string,
    isPublished?: boolean,
    version?: number  // Add version parameter for optimistic locking
}) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")

    const { id, version, ...updates } = args

    // Get current document with version
    const docWithVersion = await getDocumentWithVersion(id, user.id)
    if (!docWithVersion) throw new Error("Not found")

    // Use safe update with optimistic locking
    const result = await safeUpdateDocument({
        documentId: id,
        updates,
        options: {
            expectedVersion: version ?? docWithVersion.version,
            userId: user.id,
        },
    })

    // Invalidate cache after update
    await documentCache.invalidate(id)

    revalidatePath(`/documents/${id}`)
    revalidatePath("/documents")
    return result.data
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
