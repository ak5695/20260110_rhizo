/**
 * Shared Error Types
 *
 * This module contains error classes that can be safely imported
 * by both client and server code without triggering database connections.
 */

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
