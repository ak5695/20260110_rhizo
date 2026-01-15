"use server";

import { db } from "@/db";
import { qaItems } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq, desc, and } from "drizzle-orm";
import { headers } from "next/headers";

const getUser = async () => {
    const headersList = await headers();
    const session = await auth.api.getSession({
        headers: headersList
    });
    return session?.user;
};

export const getQaItems = async () => {
    const user = await getUser();
    if (!user) return [];

    try {
        const items = await db.select()
            .from(qaItems)
            .where(eq(qaItems.userId, user.id))
            .orderBy(desc(qaItems.createdAt));

        // Convert to frontend format (ensure type compatibility)
        return items.map(item => ({
            ...item,
            createdAt: item.createdAt.getTime(), // Convert Date to number
        }));
    } catch (error) {
        console.error("[getQaItems] Error:", error);
        return [];
    }
};

export const createQaItem = async (text: string, type: string = "custom") => {
    const user = await getUser();
    if (!user) throw new Error("Unauthorized");

    const [newItem] = await db.insert(qaItems).values({
        userId: user.id,
        text,
        type,
        status: "unasked"
    }).returning();

    return {
        ...newItem,
        createdAt: newItem.createdAt.getTime(),
    };
};

export const updateQaItem = async (id: string, updates: { status?: string; answer?: string; text?: string }) => {
    const user = await getUser();
    if (!user) throw new Error("Unauthorized");

    const [updated] = await db.update(qaItems)
        .set({
            ...updates,
            updatedAt: new Date()
        })
        .where(and(eq(qaItems.id, id), eq(qaItems.userId, user.id)))
        .returning();

    if (!updated) throw new Error("Item not found or unauthorized");

    return {
        ...updated,
        createdAt: updated.createdAt.getTime(),
    };
};

export const deleteQaItem = async (id: string) => {
    const user = await getUser();
    if (!user) throw new Error("Unauthorized");

    await db.delete(qaItems)
        .where(and(eq(qaItems.id, id), eq(qaItems.userId, user.id)));

    return true;
};
