/**
 * Canvas Server Actions
 *
 * Handles canvas CRUD operations and canvas-document associations
 */

"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { canvases, canvasElements } from "@/db/canvas-schema";
import { eq, and, inArray } from "drizzle-orm";

/**
 * Get or create a canvas for a document
 * Each document has one associated canvas
 */
export async function getOrCreateCanvas(documentId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    // Check if canvas exists
    const existing = await db
      .select()
      .from(canvases)
      .where(eq(canvases.documentId, documentId))
      .limit(1);

    if (existing.length > 0) {
      // Load canvas elements
      const elements = await db
        .select()
        .from(canvasElements)
        .where(
          and(
            eq(canvasElements.canvasId, existing[0].id),
            eq(canvasElements.isDeleted, false)
          )
        );

      return {
        success: true,
        canvas: existing[0],
        elements: elements.map((el) => el.data),
      };
    }

    // Create new canvas
    const [newCanvas] = await db
      .insert(canvases)
      .values({
        documentId,
        userId,
        lastEditedBy: userId,
        name: "Canvas",
      })
      .returning();

    console.log("[getOrCreateCanvas] Canvas created:", newCanvas.id);

    return {
      success: true,
      canvas: newCanvas,
      elements: [],
    };
  } catch (error) {
    console.error("[getOrCreateCanvas] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get or create canvas",
    };
  }
}

/**
 * Update canvas viewport state
 */
export async function updateCanvasViewport(
  canvasId: string,
  viewport: {
    x: number;
    y: number;
    zoom: number;
  }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const [updated] = await db
      .update(canvases)
      .set({
        viewportX: viewport.x,
        viewportY: viewport.y,
        zoom: viewport.zoom,
        updatedAt: new Date(),
      })
      .where(eq(canvases.id, canvasId))
      .returning();

    return {
      success: true,
      canvas: updated,
    };
  } catch (error) {
    console.error("[updateCanvasViewport] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update viewport",
    };
  }
}

/**
 * Batch save canvas elements
 * Enterprise-grade: Performs an upsert for each element
 */
export async function saveCanvasElements(
  canvasId: string,
  elements: any[]
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    if (elements.length === 0) return { success: true };

    // Prepare elements for database
    // We map Excalidraw element properties to our schema
    const values = elements.map((el) => ({
      id: el.id,
      canvasId,
      type: el.type,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      angle: el.angle || 0,
      data: el,
      zIndex: el.version || 0,
      version: el.version || 1,
      isDeleted: el.isDeleted || false,
      updatedAt: new Date(),
    }));

    // Batch upsert elements
    // This is more efficient than individual updates
    await db.insert(canvasElements)
      .values(values)
      .onConflictDoUpdate({
        target: canvasElements.id,
        set: {
          x: db.raw('EXCLUDED.x'),
          y: db.raw('EXCLUDED.y'),
          width: db.raw('EXCLUDED.width'),
          height: db.raw('EXCLUDED.height'),
          angle: db.raw('EXCLUDED.angle'),
          data: db.raw('EXCLUDED.data'),
          version: db.raw('EXCLUDED.version'),
          isDeleted: db.raw('EXCLUDED.is_deleted'),
          updatedAt: new Date(),
        }
      });

    // Update canvas modified time
    await db.update(canvases)
      .set({
        updatedAt: new Date(),
        lastEditedBy: userId
      })
      .where(eq(canvases.id, canvasId));

    return { success: true };
  } catch (error) {
    console.error("[saveCanvasElements] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save elements",
    };
  }
}

/**
 * Soft delete canvas elements
 */
export async function deleteCanvasElements(
  canvasId: string,
  elementIds: string[]
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    if (elementIds.length === 0) return { success: true };

    await db.update(canvasElements)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(canvasElements.canvasId, canvasId),
          inArray(canvasElements.id, elementIds)
        )
      );

    return { success: true };
  } catch (error) {
    console.error("[deleteCanvasElements] Error:", error);
    return { success: false, error: "Failed to delete elements" };
  }
}

/**
 * Clear all elements from a canvas
 */
export async function clearCanvas(canvasId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    await db.update(canvasElements)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(canvasElements.canvasId, canvasId));

    return { success: true };
  } catch (error) {
    console.error("[clearCanvas] Error:", error);
    return { success: false, error: "Failed to clear canvas" };
  }
}
