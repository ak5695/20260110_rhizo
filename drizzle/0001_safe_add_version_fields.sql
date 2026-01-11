-- Migration: Add version control and audit trail (SAFE - backwards compatible)
-- This migration adds optimistic locking and audit capabilities

-- Step 1: Add new columns to documents table with DEFAULT values (safe for existing rows)
ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;

ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "lastModifiedBy" text;

-- Step 2: Backfill lastModifiedBy with userId for existing rows (data preservation)
UPDATE "documents"
SET "lastModifiedBy" = "userId"
WHERE "lastModifiedBy" IS NULL;

-- Step 3: Make lastModifiedBy NOT NULL after backfill
ALTER TABLE "documents"
  ALTER COLUMN "lastModifiedBy" SET NOT NULL;

-- Step 4: Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_lastModifiedBy_user_id_fk'
  ) THEN
    ALTER TABLE "documents"
      ADD CONSTRAINT "documents_lastModifiedBy_user_id_fk"
      FOREIGN KEY ("lastModifiedBy")
      REFERENCES "public"."user"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION;
  END IF;
END $$;

-- Step 5: Add index on updatedAt for efficient queries
CREATE INDEX IF NOT EXISTS "by_updated_idx" ON "documents" USING btree ("updatedAt");

-- Step 6: Create audit log table
CREATE TABLE IF NOT EXISTS "document_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "documentId" uuid NOT NULL,
  "userId" text NOT NULL,
  "action" text NOT NULL,
  "fieldChanged" text,
  "oldValue" text,
  "newValue" text,
  "version" integer NOT NULL,
  "timestamp" timestamp DEFAULT now() NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  CONSTRAINT "document_audit_log_documentId_documents_id_fk"
    FOREIGN KEY ("documentId")
    REFERENCES "public"."documents"("id")
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT "document_audit_log_userId_user_id_fk"
    FOREIGN KEY ("userId")
    REFERENCES "public"."user"("id")
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

-- Step 7: Create indices for audit log
CREATE INDEX IF NOT EXISTS "audit_by_document_idx" ON "document_audit_log" USING btree ("documentId");
CREATE INDEX IF NOT EXISTS "audit_by_user_idx" ON "document_audit_log" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "audit_by_timestamp_idx" ON "document_audit_log" USING btree ("timestamp");

-- Step 8: Add comment for documentation
COMMENT ON COLUMN "documents"."version" IS 'Optimistic locking version number, incremented on each update';
COMMENT ON COLUMN "documents"."lastModifiedBy" IS 'User ID of last person who modified this document';
COMMENT ON TABLE "document_audit_log" IS 'Audit trail of all document changes for compliance and recovery';
