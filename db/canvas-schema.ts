/**
 * Canvas Storage Schema - Enterprise-grade canvas element storage
 *
 * Architecture:
 * - Chunked storage for large canvases
 * - Element-level granularity for efficient updates
 * - Compound node support with hierarchical structure
 * - Document binding for semantic connections
 * - [NEW] Persistent file/image storage via R2
 */

import { pgTable, text, integer, boolean, timestamp, uuid, index, jsonb, real, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { documents, user, semanticNodes } from "./schema";

/**
 * Canvas - Top-level canvas container
 * Each document can have one associated canvas
 */
export const canvases = pgTable("canvases", {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: 'cascade' }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),

    // Canvas metadata
    name: text("name").notNull().default("Untitled Canvas"),
    description: text("description"),

    // Canvas state
    viewportX: real("viewport_x").default(0),
    viewportY: real("viewport_y").default(0),
    zoom: real("zoom").default(1),

    // Versioning for optimistic locking
    version: integer("version").notNull().default(1),

    // Collaboration metadata
    lastEditedBy: text("last_edited_by").notNull().references(() => user.id),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    byDocument: index("canvas_by_document_idx").on(table.documentId),
    byUser: index("canvas_by_user_idx").on(table.userId),
}));

/**
 * Canvas Elements - Individual elements on the canvas
 * Supports all Excalidraw element types + custom types
 */
export const canvasElements = pgTable("canvas_elements", {
    id: text("id").primaryKey(), // Use Excalidraw element ID (string)
    canvasId: uuid("canvas_id").notNull().references(() => canvases.id, { onDelete: 'cascade' }),

    // Element type (rectangle, ellipse, arrow, text, etc.)
    type: varchar("type", { length: 50 }).notNull(),

    // Position and dimensions
    x: real("x").notNull(),
    y: real("y").notNull(),
    width: real("width").notNull(),
    height: real("height").notNull(),
    angle: real("angle").default(0),

    // Element data (full Excalidraw element JSON)
    data: jsonb("data").notNull(),

    // Compound node relationship
    compoundNodeId: uuid("compound_node_id").references(() => compoundNodes.id, { onDelete: 'set null' }),

    // Layer/z-index for rendering order
    zIndex: integer("z_index").notNull().default(0),

    // Binding to document blocks
    boundBlockId: uuid("bound_block_id"),
    boundSemanticNodeId: uuid("bound_semantic_node_id").references(() => semanticNodes.id, { onDelete: 'set null' }),

    // Binding metadata
    bindingType: varchar("binding_type", { length: 50 }), // 'direct', 'reference', 'annotation'
    bindingMetadata: jsonb("binding_metadata"),

    // Human arbitration for AI-generated bindings
    bindingStatus: varchar("binding_status", { length: 50 }).default('pending'), // 'pending', 'approved', 'rejected'
    bindingProvenanceType: varchar("binding_provenance", { length: 50 }), // 'user', 'ai', 'system'

    // Soft delete for undo/redo
    isDeleted: boolean("is_deleted").default(false),
    deletedAt: timestamp("deleted_at"),

    // Versioning
    version: integer("version").notNull().default(1),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    byCanvas: index("elements_by_canvas_idx").on(table.canvasId),
    byCompound: index("elements_by_compound_idx").on(table.compoundNodeId),
    byBoundBlock: index("elements_by_bound_block_idx").on(table.boundBlockId),
    byBoundNode: index("elements_by_bound_node_idx").on(table.boundSemanticNodeId),
    spatial: index("elements_spatial_idx").on(table.canvasId, table.x, table.y),
}));

/**
 * Canvas Files - Persistent storage for binary files (Images, etc.)
 * Used to populate Excalidraw's `files` property.
 */
export const canvasFiles = pgTable("canvas_files", {
    id: text("id").primaryKey(), // Excalidraw File ID (e.g. "hash...")
    canvasId: uuid("canvas_id").notNull().references(() => canvases.id, { onDelete: 'cascade' }),

    dataUrl: text("data_url").notNull(), // The R2 Public URL
    mimeType: varchar("mime_type", { length: 100 }).notNull(),

    // For sorting/cleanup
    created: timestamp("created").defaultNow().notNull(), // Mapped to Excalidraw 'created'
    lastRetrieved: timestamp("last_retrieved"),

    uploadedBy: text("uploaded_by").references(() => user.id),
}, (table) => ({
    byCanvas: index("files_by_canvas_idx").on(table.canvasId),
}));


/**
 * Compound Nodes - Groups of elements that move together
 * Hierarchical structure supporting nested compounds
 */
export const compoundNodes: any = pgTable("compound_nodes", {
    id: uuid("id").defaultRandom().primaryKey(),
    canvasId: uuid("canvas_id").notNull().references(() => canvases.id, { onDelete: 'cascade' }),

    // Compound metadata
    name: text("name").notNull(),
    description: text("description"),

    // Parent compound for nested structures
    parentCompoundId: uuid("parent_compound_id").references(() => compoundNodes.id, { onDelete: 'cascade' }),

    // Bounding box (calculated from child elements)
    boundingBoxX: real("bounding_box_x").notNull(),
    boundingBoxY: real("bounding_box_y").notNull(),
    boundingBoxWidth: real("bounding_box_width").notNull(),
    boundingBoxHeight: real("bounding_box_height").notNull(),

    // Binding to document/semantic nodes
    boundBlockId: uuid("bound_block_id"),
    boundSemanticNodeId: uuid("bound_semantic_node_id").references(() => semanticNodes.id, { onDelete: 'set null' }),

    // Binding metadata
    bindingMetadata: jsonb("binding_metadata"),
    bindingStatus: varchar("binding_status", { length: 50 }).default('pending'),
    bindingProvenanceType: varchar("binding_provenance", { length: 50 }),

    // Versioning
    version: integer("version").notNull().default(1),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    byCanvas: index("compounds_by_canvas_idx").on(table.canvasId),
    byParent: index("compounds_by_parent_idx").on(table.parentCompoundId),
    byBoundBlock: index("compounds_by_bound_block_idx").on(table.boundBlockId),
}));

/**
 * Canvas Change Log - Incremental updates for real-time sync
 * CRDT-compatible change tracking
 */
export const canvasChangeLog = pgTable("canvas_change_log", {
    id: uuid("id").defaultRandom().primaryKey(),
    canvasId: uuid("canvas_id").notNull().references(() => canvases.id, { onDelete: 'cascade' }),

    // Change type
    changeType: varchar("change_type", { length: 50 }).notNull(), // 'create', 'update', 'delete', 'move', 'bind'

    // Target entity
    entityType: varchar("entity_type", { length: 50 }).notNull(), // 'element', 'compound', 'binding'
    entityId: uuid("entity_id").notNull(),

    // Change data
    changeData: jsonb("change_data").notNull(),
    previousData: jsonb("previous_data"),

    // User and session info
    userId: text("user_id").notNull().references(() => user.id),
    sessionId: text("session_id"),

    // Vector clock for CRDT
    vectorClock: jsonb("vector_clock"),

    // Timestamp
    timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
    byCanvas: index("changelog_by_canvas_idx").on(table.canvasId, table.timestamp),
    byEntity: index("changelog_by_entity_idx").on(table.entityType, table.entityId),
    byTimestamp: index("changelog_by_timestamp_idx").on(table.timestamp),
}));

/**
 * Document-Canvas Bindings - Semantic connections
 * Tracks relationships between document content and canvas elements
 */
export const documentCanvasBindings = pgTable("document_canvas_bindings", {
    id: uuid("id").defaultRandom().primaryKey(),

    // Source (document side)
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: 'cascade' }),
    blockId: uuid("block_id"),
    textRange: jsonb("text_range"), // {start: number, end: number}
    semanticNodeId: uuid("semantic_node_id").references(() => semanticNodes.id, { onDelete: 'cascade' }),

    // Target (canvas side)
    canvasId: uuid("canvas_id").notNull().references(() => canvases.id, { onDelete: 'cascade' }),
    elementId: text("element_id"), // Can be element or compound (string ID)
    compoundNodeId: uuid("compound_node_id").references(() => compoundNodes.id, { onDelete: 'cascade' }),

    // Binding metadata
    bindingType: varchar("binding_type", { length: 50 }).notNull(), // 'direct', 'reference', 'annotation', 'derived'
    direction: varchar("direction", { length: 20 }).notNull(), // 'doc_to_canvas', 'canvas_to_doc', 'bidirectional'

    // Semantic information
    anchorText: text("anchor_text"),
    semanticLabel: text("semantic_label"),
    confidence: real("confidence"), // AI confidence score (0-1)

    // Human arbitration
    status: varchar("status", { length: 50 }).notNull().default('pending'), // 'pending', 'approved', 'rejected', 'modified'
    provenance: varchar("provenance", { length: 50 }).notNull(), // 'user', 'ai', 'system', 'drag_drop'
    reviewedBy: text("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at"),
    reviewNotes: text("review_notes"),

    // Existence Arbitration System (EAS)
    currentStatus: varchar("current_status", { length: 20 }).notNull().default('visible'), // 'visible' | 'hidden' | 'deleted' | 'pending'
    statusUpdatedAt: timestamp("status_updated_at"),
    statusUpdatedBy: text("status_updated_by").references(() => user.id),

    // Sync state
    lastSyncedAt: timestamp("last_synced_at"),
    syncErrors: jsonb("sync_errors"),

    // Metadata for future extensions
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    byDocument: index("bindings_by_document_idx").on(table.documentId),
    byCanvas: index("bindings_by_canvas_idx").on(table.canvasId),
    byElement: index("bindings_by_element_idx").on(table.elementId),
    byCompound: index("bindings_by_compound_idx").on(table.compoundNodeId),
    byStatus: index("bindings_by_status_idx").on(table.status),
    byProvenance: index("bindings_by_provenance_idx").on(table.provenance),
    // EAS indexes
    byCurrentStatus: index("bindings_by_current_status_idx").on(table.currentStatus),
    byCanvasStatus: index("bindings_by_canvas_status_idx").on(table.canvasId, table.currentStatus),
}));

/**
 * Collaboration Sessions - Real-time collaboration tracking
 */
export const collaborationSessions = pgTable("collaboration_sessions", {
    id: uuid("id").defaultRandom().primaryKey(),
    canvasId: uuid("canvas_id").notNull().references(() => canvases.id, { onDelete: 'cascade' }),
    userId: text("user_id").notNull().references(() => user.id),

    // Session metadata
    connectionId: text("connection_id").notNull().unique(),
    cursorPosition: jsonb("cursor_position"), // {x: number, y: number}
    selectedElements: jsonb("selected_elements"), // array of element IDs

    // Status
    isActive: boolean("is_active").default(true),
    lastHeartbeat: timestamp("last_heartbeat").defaultNow().notNull(),

    // Session info
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),

    connectedAt: timestamp("connected_at").defaultNow().notNull(),
    disconnectedAt: timestamp("disconnected_at"),
}, (table) => ({
    byCanvas: index("sessions_by_canvas_idx").on(table.canvasId, table.isActive),
    byUser: index("sessions_by_user_idx").on(table.userId),
    byConnection: index("sessions_by_connection_idx").on(table.connectionId),
}));

/**
 * Binding Status Log - Audit trail for status transitions
 * Part of the Existence Arbitration System (EAS)
 */
export const bindingStatusLog = pgTable("binding_status_log", {
    id: uuid("id").defaultRandom().primaryKey(),
    bindingId: uuid("binding_id").notNull().references(() => documentCanvasBindings.id, { onDelete: 'cascade' }),

    // Status transition
    status: varchar("status", { length: 20 }).notNull(), // 'visible' | 'hidden' | 'deleted' | 'pending'
    previousStatus: varchar("previous_status", { length: 20 }),

    // Transition metadata
    transitionType: varchar("transition_type", { length: 50 }).notNull(), // 'user_hide', 'user_delete', 'user_restore', 'system_reconcile', 'arbitration_approve', 'arbitration_reject'
    transitionReason: text("transition_reason"),

    // Actor information
    actorId: text("actor_id").references(() => user.id),
    actorType: varchar("actor_type", { length: 20 }), // 'user' | 'system' | 'ai'

    // Audit trail
    createdAt: timestamp("created_at").defaultNow().notNull(),
    metadata: jsonb("metadata"),
}, (table) => ({
    byBinding: index("status_log_by_binding_idx").on(table.bindingId),
    byTimestamp: index("status_log_by_timestamp_idx").on(table.createdAt),
    byActor: index("status_log_by_actor_idx").on(table.actorId),
}));

/**
 * Binding Inconsistencies - Detected conflicts for arbitration
 * Part of the Existence Arbitration System (EAS)
 */
export const bindingInconsistencies = pgTable("binding_inconsistencies", {
    id: uuid("id").defaultRandom().primaryKey(),
    bindingId: uuid("binding_id").references(() => documentCanvasBindings.id, { onDelete: 'cascade' }),

    // Inconsistency type
    type: varchar("type", { length: 50 }).notNull(), // 'orphaned' | 'missing-element' | 'missing-mark' | 'status-mismatch' | 'ghost-binding'

    // Detection metadata
    detectedAt: timestamp("detected_at").defaultNow().notNull(),
    detectedBy: varchar("detected_by", { length: 20 }), // 'system' | 'user' | 'reconciliation'

    // Current state snapshot
    bindingStatus: varchar("binding_status", { length: 20 }),
    elementDeleted: boolean("element_deleted"),
    markExists: boolean("mark_exists"),

    // Resolution strategy
    suggestedResolution: varchar("suggested_resolution", { length: 50 }), // 'delete-binding' | 'restore-element' | 'demote-to-pending' | 'update-status' | 'manual-review'
    resolutionConfidence: real("resolution_confidence"), // 0-1

    // Resolution tracking
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: text("resolved_by").references(() => user.id),
    resolutionAction: varchar("resolution_action", { length: 50 }),
    resolutionNotes: text("resolution_notes"),

    // Metadata
    snapshot: jsonb("snapshot"), // Full state snapshot for debugging
}, (table) => ({
    byBinding: index("inconsistencies_by_binding_idx").on(table.bindingId),
    byType: index("inconsistencies_by_type_idx").on(table.type),
    byResolved: index("inconsistencies_by_resolved_idx").on(table.resolvedAt),
}));

/**
 * Binding Existence Cache - Performance optimization
 * Part of the Existence Arbitration System (EAS)
 */
export const bindingExistenceCache = pgTable("binding_existence_cache", {
    bindingId: uuid("binding_id").primaryKey().references(() => documentCanvasBindings.id, { onDelete: 'cascade' }),

    // Cached state
    status: varchar("status", { length: 20 }).notNull(),
    elementExists: boolean("element_exists").notNull().default(true),
    elementDeleted: boolean("element_deleted").notNull().default(false),
    markExists: boolean("mark_exists").notNull().default(true),

    // Cache metadata
    lastVerifiedAt: timestamp("last_verified_at").defaultNow().notNull(),
    cacheVersion: integer("cache_version").notNull().default(1),

    // Invalidation
    isStale: boolean("is_stale").default(false),
}, (table) => ({
    byStatus: index("cache_by_status_idx").on(table.status),
    byStale: index("cache_by_stale_idx").on(table.isStale),
}));

// Relations
export const canvasesRelations = relations(canvases, ({ one, many }) => ({
    document: one(documents, {
        fields: [canvases.documentId],
        references: [documents.id],
    }),
    user: one(user, {
        fields: [canvases.userId],
        references: [user.id],
    }),
    elements: many(canvasElements),
    compoundNodes: many(compoundNodes),
    changeLog: many(canvasChangeLog),
    bindings: many(documentCanvasBindings),
    sessions: many(collaborationSessions),
    files: many(canvasFiles),
}));

export const canvasElementsRelations = relations(canvasElements, ({ one }) => ({
    canvas: one(canvases, {
        fields: [canvasElements.canvasId],
        references: [canvases.id],
    }),
    compoundNode: one(compoundNodes, {
        fields: [canvasElements.compoundNodeId],
        references: [compoundNodes.id],
    }),
    semanticNode: one(semanticNodes, {
        fields: [canvasElements.boundSemanticNodeId],
        references: [semanticNodes.id],
    }),
}));

export const canvasFilesRelations = relations(canvasFiles, ({ one }) => ({
    canvas: one(canvases, {
        fields: [canvasFiles.canvasId],
        references: [canvases.id],
    }),
    user: one(user, {
        fields: [canvasFiles.uploadedBy],
        references: [user.id],
    }),
}));


export const compoundNodesRelations = relations(compoundNodes, ({ one, many }) => ({
    canvas: one(canvases, {
        fields: [compoundNodes.canvasId],
        references: [canvases.id],
    }),
    parentCompound: one(compoundNodes, {
        fields: [compoundNodes.parentCompoundId],
        references: [compoundNodes.id],
        relationName: "parent",
    }),
    childCompounds: many(compoundNodes, { relationName: "parent" }),
    elements: many(canvasElements),
    semanticNode: one(semanticNodes, {
        fields: [compoundNodes.boundSemanticNodeId],
        references: [semanticNodes.id],
    }),
}));

export const documentCanvasBindingsRelations = relations(documentCanvasBindings, ({ one }) => ({
    document: one(documents, {
        fields: [documentCanvasBindings.documentId],
        references: [documents.id],
    }),
    canvas: one(canvases, {
        fields: [documentCanvasBindings.canvasId],
        references: [canvases.id],
    }),
    compound: one(compoundNodes, {
        fields: [documentCanvasBindings.compoundNodeId],
        references: [compoundNodes.id],
    }),
    semanticNode: one(semanticNodes, {
        fields: [documentCanvasBindings.semanticNodeId],
        references: [semanticNodes.id],
    }),
}));
