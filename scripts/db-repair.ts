
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env" });

async function main() {
    const sql = neon(process.env.DATABASE_URL!);

    console.log("Starting surgical SQL column renames...");

    try {
        // Handle "user" table renames if they are still camelCase
        try {
            await sql`ALTER TABLE "user" RENAME COLUMN "banReason" TO "ban_reason"`;
            console.log("Renamed user.banReason to user.ban_reason");
        } catch (e) {
            console.log("user.banReason rename skipped or not needed.");
        }

        try {
            await sql`ALTER TABLE "user" RENAME COLUMN "banExpires" TO "ban_expires"`;
            console.log("Renamed user.banExpires to user.ban_expires");
        } catch (e) {
            console.log("user.banExpires rename skipped or not needed.");
        }

        // Handle "waitlist" table rename
        try {
            await sql`ALTER TABLE "waitlist" RENAME COLUMN "createdAt" TO "created_at"`;
            console.log("Renamed waitlist.createdAt to waitlist.created_at");
        } catch (e) {
            console.log("waitlist.createdAt rename skipped or not needed.");
        }

        console.log("Surgical column renames complete.");
    } catch (error) {
        console.error("Manual rename failed:", error);
    }
}

main();
