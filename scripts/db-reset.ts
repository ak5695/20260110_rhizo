
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env" });

async function main() {
    const sql = neon(process.env.DATABASE_URL!);

    console.log("Starting surgical auth table reset...");

    try {
        // Drop tables in reverse order of dependencies
        // Added CASCADE to ensure thorough cleanup
        await sql`DROP TABLE IF EXISTS "session" CASCADE`;
        await sql`DROP TABLE IF EXISTS "account" CASCADE`;
        await sql`DROP TABLE IF EXISTS "verification" CASCADE`;
        await sql`DROP TABLE IF EXISTS "user" CASCADE`;
        // Also drop the drizzle migrations table to reset the history
        await sql`DROP TABLE IF EXISTS "__drizzle_migrations" CASCADE`;

        console.log("Auth tables and migration history successfully purged.");
    } catch (error) {
        console.error("Failed to reset database:", error);
        process.exit(1);
    }
}

main();
