"use server";

import { db } from "@/db";
import { waitlist } from "@/db/schema";
import { revalidatePath } from "next/cache";

export async function joinWaitlist(email: string) {
    try {
        if (!email || !email.includes("@")) {
            return {
                success: false,
                error: "Please enter a valid email address."
            };
        }

        await db.insert(waitlist).values({
            email,
        }).onConflictDoNothing(); // Prevent duplicate errors if email unique

        return {
            success: true,
            message: "You're on the list! We'll be in touch."
        };
    } catch (error) {
        console.error("Waitlist error:", error);
        return {
            success: false,
            error: "Something went wrong. Please try again."
        };
    }
}
