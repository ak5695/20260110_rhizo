/**
 * Canvas Binding Server Actions
 *
 * Handles creation and management of document-canvas bindings
 * Integrates with the enterprise canvas storage system
 */

"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { documentCanvasBindings, canvasElements } from "@/db/canvas-schema";
import { eq, and, getTableColumns } from "drizzle-orm";
import type { DropResult } from "@/lib/canvas/drag-drop-types";

interface CreateBindingInput {
  canvasId: string;
  documentId: string;
  elementId: string;
  blockId?: string;
  semanticNodeId?: string;
  bindingType: string;
  sourceType: string;
  anchorText: string;
  metadata?: Record<string, any>;
}

/**
 * Create a document-canvas binding from a drag-drop operation
 */
export async function createCanvasBinding(input: CreateBindingInput) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    // Create the binding record
    const [binding] = await db
      .insert(documentCanvasBindings)
      .values({
        documentId: input.documentId,
        blockId: input.blockId,
        semanticNodeId: input.semanticNodeId,
        canvasId: input.canvasId,
        elementId: input.elementId,
        bindingType: input.bindingType,
        direction: "doc_to_canvas",
        anchorText: input.anchorText,
        status: "approved", // User-created bindings are auto-approved
        provenance: "drag_drop",
        metadata: input.metadata,
      })
      .returning();

    console.log("[createCanvasBinding] Binding created:", binding.id);

    // Register with ExistenceEngine (EAS) to update memory maps
    try {
      const { existenceEngine } = await import('@/lib/existence-engine');
      await existenceEngine.registerBinding(binding);
    } catch (e) {
      console.error("[createCanvasBinding] Failed to register with ExistenceEngine:", e);
      // We don't fail the request, just log it. 
      // It might be that the engine is not initialized for this canvas yet, which is fine.
    }

    return {
      success: true,
      binding,
    };
  } catch (error) {
    console.error("[createCanvasBinding] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create binding",
    };
  }
}

/**
 * Save canvas elements to database
 * Used when elements are created via drag-drop
 */
export async function saveCanvasElements(
  canvasId: string,
  elements: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    angle?: number;
    data: any;
    boundBlockId?: string;
    boundSemanticNodeId?: string;
  }>
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    // Insert or update elements
    const savedElements = await Promise.all(
      elements.map(async (element) => {
        const [saved] = await db
          .insert(canvasElements)
          .values({
            id: element.id,
            canvasId,
            type: element.type,
            x: element.x,
            y: element.y,
            width: element.width,
            height: element.height,
            angle: element.angle || 0,
            data: element.data,
            boundBlockId: element.boundBlockId,
            boundSemanticNodeId: element.boundSemanticNodeId,
            bindingProvenanceType: "user",
            bindingStatus: "approved",
          })
          .onConflictDoUpdate({
            target: canvasElements.id,
            set: {
              type: element.type,
              x: element.x,
              y: element.y,
              width: element.width,
              height: element.height,
              angle: element.angle || 0,
              data: element.data,
              updatedAt: new Date(),
            },
          })
          .returning();

        return saved;
      })
    );

    console.log("[saveCanvasElements] Elements saved:", savedElements.length);

    return {
      success: true,
      elements: savedElements,
    };
  } catch (error) {
    console.error("[saveCanvasElements] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save elements",
    };
  }
}

/**
 * Get bindings for a canvas
 */
export async function getCanvasBindings(canvasId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const bindings = await db
      .select({
        ...getTableColumns(documentCanvasBindings),
        isElementDeleted: canvasElements.isDeleted
      })
      .from(documentCanvasBindings)
      .leftJoin(canvasElements, and(
        eq(documentCanvasBindings.elementId, canvasElements.id),
        eq(documentCanvasBindings.canvasId, canvasElements.canvasId)
      ))
      .where(eq(documentCanvasBindings.canvasId, canvasId));

    return {
      success: true,
      bindings,
    };
  } catch (error) {
    console.error("[getCanvasBindings] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get bindings",
    };
  }
}

/**
 * Delete a binding
 */
export async function deleteCanvasBinding(bindingId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    await db
      .delete(documentCanvasBindings)
      .where(eq(documentCanvasBindings.id, bindingId));

    console.log("[deleteCanvasBinding] Binding deleted:", bindingId);

    return { success: true };
  } catch (error) {
    console.error("[deleteCanvasBinding] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete binding",
    };
  }
}

/**
 * Update binding status (for human arbitration)
 */
export async function updateBindingStatus(
  bindingId: string,
  status: "pending" | "approved" | "rejected" | "modified",
  reviewNotes?: string
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    const [updated] = await db
      .update(documentCanvasBindings)
      .set({
        status,
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes,
      })
      .where(eq(documentCanvasBindings.id, bindingId))
      .returning();

    console.log("[updateBindingStatus] Binding updated:", bindingId, status);

    return {
      success: true,
      binding: updated,
    };
  } catch (error) {
    console.error("[updateBindingStatus] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update binding status",
    };
  }
}

/**
 * 清理孤立绑定（元素已被删除但绑定记录仍存在）
 * 企业级解决方案：彻底清理幽灵绑定
 */
export async function cleanupOrphanedBindings(canvasId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    // 查找所有绑定到已删除元素的绑定记录
    const orphanedBindings = await db
      .select({
        bindingId: documentCanvasBindings.id,
        elementId: documentCanvasBindings.elementId
      })
      .from(documentCanvasBindings)
      .leftJoin(canvasElements, and(
        eq(documentCanvasBindings.elementId, canvasElements.id),
        eq(documentCanvasBindings.canvasId, canvasElements.canvasId)
      ))
      .where(
        and(
          eq(documentCanvasBindings.canvasId, canvasId),
          eq(canvasElements.isDeleted, true)
        )
      );

    if (orphanedBindings.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    // 批量删除孤立绑定
    const bindingIds = orphanedBindings.map(b => b.bindingId);

    for (const bindingId of bindingIds) {
      await db
        .delete(documentCanvasBindings)
        .where(eq(documentCanvasBindings.id, bindingId));
    }

    console.log("[cleanupOrphanedBindings] Cleaned up", bindingIds.length, "orphaned bindings");

    return {
      success: true,
      deletedCount: bindingIds.length,
      deletedBindingIds: bindingIds
    };
  } catch (error) {
    console.error("[cleanupOrphanedBindings] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cleanup orphaned bindings",
    };
  }
}

/**
 * 删除绑定（通过elementId）
 * 当用户在画布上删除元素时调用
 */
export async function deleteBindingsByElementIds(canvasId: string, elementIds: string[]) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const deletedBindings: any[] = [];

    // 删除所有关联的绑定
    for (const elementId of elementIds) {
      const bindings = await db
        .select()
        .from(documentCanvasBindings)
        .where(
          and(
            eq(documentCanvasBindings.canvasId, canvasId),
            eq(documentCanvasBindings.elementId, elementId)
          )
        );

      for (const binding of bindings) {
        await db
          .delete(documentCanvasBindings)
          .where(eq(documentCanvasBindings.id, binding.id));

        deletedBindings.push(binding);
      }
    }

    console.log("[deleteBindingsByElementIds] Deleted", deletedBindings.length, "bindings");

    return {
      success: true,
      deletedCount: deletedBindings.length,
      deletedBindings
    };
  } catch (error) {
    console.error("[deleteBindingsByElementIds] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete bindings",
    };
  }
}

/**
 * Batch update binding statuses (for optimistic sync)
 * Single DB transaction for multiple updates
 */
export async function batchUpdateBindingStatus(
  updates: Array<{ bindingId: string; status: 'visible' | 'hidden' | 'deleted' | 'pending' }>
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    if (updates.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    const userId = session.user.id;

    // Batch update using Promise.all for parallelism
    await Promise.all(
      updates.map(({ bindingId, status }) =>
        db
          .update(documentCanvasBindings)
          .set({
            currentStatus: status,
            statusUpdatedAt: new Date(),
            statusUpdatedBy: userId,
            updatedAt: new Date(),
          })
          .where(eq(documentCanvasBindings.id, bindingId))
      )
    );

    console.log("[batchUpdateBindingStatus] Updated", updates.length, "bindings");

    return {
      success: true,
      updatedCount: updates.length,
    };
  } catch (error) {
    console.error("[batchUpdateBindingStatus] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to batch update bindings",
    };
  }
}
