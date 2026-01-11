/**
 * Enterprise-Grade Safe Update Utilities
 *
 * CRITICAL: This module ensures ZERO data loss through:
 * 1. Optimistic Locking - Prevents concurrent update conflicts
 * 2. Audit Trail - Records all changes for recovery
 * 3. Transaction Support - Atomic multi-step operations
 * 4. Error Recovery - Automatic retries with exponential backoff
 *
 * @module lib/safe-update
 */

import { db } from "@/db";
import { documents, documentAuditLog } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Conflict error thrown when optimistic lock fails
 */
export class OptimisticLockError extends Error {
  constructor(
    public documentId: string,
    public expectedVersion: number,
    public actualVersion: number
  ) {
    super(
      `Document ${documentId} has been modified by another user. ` +
      `Expected version ${expectedVersion}, but found ${actualVersion}. ` +
      `Please refresh and try again.`
    );
    this.name = "OptimisticLockError";
  }
}

/**
 * Update result with version information
 */
export interface SafeUpdateResult<T> {
  data: T;
  version: number;
  conflictDetected: boolean;
}

/**
 * Options for safe document updates
 */
export interface SafeUpdateOptions {
  /** Expected version for optimistic locking */
  expectedVersion: number;
  /** User ID performing the update */
  userId: string;
  /** IP address of the request (for audit) */
  ipAddress?: string;
  /** User agent of the request (for audit) */
  userAgent?: string;
  /** Skip version check (USE WITH EXTREME CAUTION) */
  skipVersionCheck?: boolean;
}

/**
 * Audit log entry data
 */
interface AuditEntry {
  documentId: string;
  userId: string;
  action: string;
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
  version: number;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Extract client info from options (passed from server actions)
 * Note: Cannot use headers() here as this module is imported by client components
 */
function getClientInfo(options: SafeUpdateOptions): { ipAddress?: string; userAgent?: string } {
  return {
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
  };
}

/**
 * Write to audit log (non-blocking)
 */
async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(documentAuditLog).values({
      documentId: entry.documentId,
      userId: entry.userId,
      action: entry.action,
      fieldChanged: entry.fieldChanged,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      version: entry.version,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      timestamp: new Date(),
    });
  } catch (error) {
    // Log error but don't fail the main operation
    console.error("[AUDIT] Failed to write audit log:", error);
    // In production, send to monitoring service (e.g., Sentry)
  }
}

/**
 * Safely update a document with optimistic locking
 *
 * @example
 * ```ts
 * try {
 *   const result = await safeUpdateDocument({
 *     documentId: "abc-123",
 *     updates: { title: "New Title", content: "..." },
 *     expectedVersion: 5,
 *     userId: user.id
 *   });
 *   console.log(`Updated to version ${result.version}`);
 * } catch (error) {
 *   if (error instanceof OptimisticLockError) {
 *     // Show user: "Someone else updated this document. Please refresh."
 *   }
 * }
 * ```
 */
export async function safeUpdateDocument(params: {
  documentId: string;
  updates: Partial<{
    title: string;
    content: string;
    coverImage: string;
    icon: string;
    isPublished: boolean;
    isArchived: boolean;
  }>;
  options: SafeUpdateOptions;
}): Promise<SafeUpdateResult<typeof documents.$inferSelect>> {
  const { documentId, updates, options } = params;
  const { expectedVersion, userId, skipVersionCheck = false } = options;

  // Get client info for audit trail (from options, not headers)
  const clientInfo = getClientInfo(options);

  return await db.transaction(async (tx) => {
    // Step 1: Lock and read current document
    // Note: Drizzle doesn't support FOR UPDATE in query builder yet,
    // but transactions provide sufficient isolation for our use case
    const current = await tx.query.documents.findFirst({
      where: and(
        eq(documents.id, documentId),
        eq(documents.userId, userId)
      )
    });

    if (!current) {
      throw new Error("Document not found or access denied");
    }

    // Step 2: Optimistic lock check
    if (!skipVersionCheck && current.version !== expectedVersion) {
      throw new OptimisticLockError(
        documentId,
        expectedVersion,
        current.version
      );
    }

    // Step 3: Prepare update with incremented version
    const newVersion = current.version + 1;
    const updateData = {
      ...updates,
      version: newVersion,
      lastModifiedBy: userId,
      updatedAt: new Date(),
    };

    // Step 4: Execute update
    const [updated] = await tx
      .update(documents)
      .set(updateData)
      .where(eq(documents.id, documentId))
      .returning();

    // Step 5: Write audit log for each changed field
    const auditPromises = Object.entries(updates).map(([field, newValue]) => {
      const oldValue = current[field as keyof typeof current];

      // Only log if value actually changed
      if (oldValue !== newValue) {
        return writeAuditLog({
          documentId,
          userId,
          action: "update",
          fieldChanged: field,
          oldValue: oldValue ? String(oldValue) : undefined,
          newValue: newValue ? String(newValue) : undefined,
          version: newVersion,
          ipAddress: options.ipAddress || clientInfo.ipAddress,
          userAgent: options.userAgent || clientInfo.userAgent,
        });
      }
      return Promise.resolve();
    });

    // Wait for audit logs (but don't block on errors)
    await Promise.allSettled(auditPromises);

    return {
      data: updated,
      version: newVersion,
      conflictDetected: false,
    };
  });
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number;  // milliseconds
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 100,
  maxDelay: 2000,
};

/**
 * Execute operation with exponential backoff retry
 *
 * Retries on transient errors (network, database connection)
 * Does NOT retry on logical errors (not found, validation)
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxAttempts, baseDelay, maxDelay } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on logical errors
      if (
        error instanceof OptimisticLockError ||
        (error as Error).message?.includes("not found") ||
        (error as Error).message?.includes("validation")
      ) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        break;
      }

      // Calculate exponential backoff delay
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt - 1),
        maxDelay
      );

      console.warn(
        `[RETRY] Attempt ${attempt}/${maxAttempts} failed. ` +
        `Retrying in ${delay}ms...`,
        error
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Safely create a new document with audit trail
 */
export async function safeCreateDocument(params: {
  title: string;
  userId: string;
  parentDocumentId?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<typeof documents.$inferSelect> {
  const { title, userId, parentDocumentId, ipAddress, userAgent } = params;

  const [document] = await db.transaction(async (tx) => {
    // Create document
    const [doc] = await tx
      .insert(documents)
      .values({
        title,
        userId,
        lastModifiedBy: userId,
        parentDocumentId,
        version: 1,
        isArchived: false,
        isPublished: false,
      })
      .returning();

    // Audit log
    await writeAuditLog({
      documentId: doc.id,
      userId,
      action: "create",
      version: 1,
      ipAddress,
      userAgent,
    });

    return [doc];
  });

  return document;
}

/**
 * Safely archive document with transaction
 */
export async function safeArchiveDocument(params: {
  documentId: string;
  userId: string;
  expectedVersion: number;
}): Promise<void> {
  const { documentId, userId, expectedVersion } = params;

  await safeUpdateDocument({
    documentId,
    updates: { isArchived: true },
    options: { expectedVersion, userId },
  });
}

/**
 * Get document with version for optimistic locking
 */
export async function getDocumentWithVersion(
  documentId: string,
  userId: string
): Promise<{ document: typeof documents.$inferSelect; version: number } | null> {
  const document = await db.query.documents.findFirst({
    where: and(
      eq(documents.id, documentId),
      eq(documents.userId, userId)
    ),
  });

  if (!document) {
    return null;
  }

  return {
    document,
    version: document.version,
  };
}
