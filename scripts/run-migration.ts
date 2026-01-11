/**
 * Manual Migration Runner for Enterprise Features
 *
 * Runs the 0001_safe_add_version_fields.sql migration directly
 * This is safe to run multiple times due to IF NOT EXISTS checks
 */

// CRITICAL: Load environment variables BEFORE importing db
import { config } from "dotenv";
config();

import { db } from "../db";
import { sql } from "drizzle-orm";
import { readFileSync } from "fs";
import { join } from "path";

async function runMigration() {
  console.log("[Migration] Reading migration file...");
  const migrationSQL = readFileSync(
    join(process.cwd(), "drizzle", "0001_safe_add_version_fields.sql"),
    "utf-8"
  );

  console.log("[Migration] Executing migration...");
  try {
    // Execute raw SQL using Drizzle
    await db.execute(sql.raw(migrationSQL));
    console.log("[Migration] ✅ Migration completed successfully!");

    // Verify the changes
    const versionCheck = await db.execute(sql.raw(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'documents'
      AND column_name IN ('version', 'lastModifiedBy')
      ORDER BY column_name;
    `));

    console.log("[Migration] Verification:");
    console.log(versionCheck.rows);

    const auditTableCheck = await db.execute(sql.raw(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'document_audit_log';
    `));

    if (auditTableCheck.rows.length > 0) {
      console.log("[Migration] ✅ Audit log table created successfully");
    } else {
      console.log("[Migration] ⚠️ Audit log table not found");
    }
  } catch (error) {
    console.error("[Migration] ❌ Migration failed:", error);
    throw error;
  }
}

runMigration()
  .then(() => {
    console.log("[Migration] Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[Migration] Fatal error:", error);
    process.exit(1);
  });
