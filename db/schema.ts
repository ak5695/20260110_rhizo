
import { pgTable, text, integer, boolean, timestamp, uuid, index, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("emailVerified").notNull().default(true),
    image: text("image"),
    password: text("password"),
    role: text("role").notNull().default("user"),
    banned: boolean("banned").notNull().default(false),
    banReason: text("banReason"),
    banExpires: timestamp("banExpires"),
    createdAt: timestamp("createdAt").notNull(),
    updatedAt: timestamp("updatedAt").notNull()
});

export const session = pgTable("session", {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt").notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId").notNull().references(() => user.id),
    token: text("token").notNull().unique(),
    createdAt: timestamp("createdAt").notNull(),
    updatedAt: timestamp("updatedAt").notNull()
});

export const account = pgTable("account", {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId").notNull().references(() => user.id),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    expiresAt: timestamp("expiresAt"),
    createdAt: timestamp("createdAt").notNull(),
    updatedAt: timestamp("updatedAt").notNull()
});

export const verification = pgTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").notNull(),
    updatedAt: timestamp("updatedAt").notNull()
});

// Notion-clone specific tables

export const documents = pgTable("documents", {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    userId: text("userId").notNull().references(() => user.id, { onDelete: 'cascade' }),
    isArchived: boolean("isArchived").notNull().default(false),
    parentDocumentId: uuid("parentDocumentId"),
    content: text("content"),
    coverImage: text("coverImage"),
    icon: text("icon"),
    isPublished: boolean("isPublished").notNull().default(false),
    // Optimistic locking: incremented on every update
    version: integer("version").notNull().default(1),
    migrationVersion: integer("migrationVersion").notNull().default(0),
    // Audit trail: track last modifier
    lastModifiedBy: text("lastModifiedBy").notNull().references(() => user.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => {
    return {
        byUser: index("by_user_idx").on(table.userId),
        byUserParent: index("by_user_parent_idx").on(table.userId, table.parentDocumentId),
        byUpdated: index("by_updated_idx").on(table.updatedAt),
    }
});

export const documentBlocks = pgTable("document_blocks", {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("documentId")
        .notNull()
        .references(() => documents.id, { onDelete: 'cascade' }),
    type: text("type").notNull(),
    text: text("text").notNull().default(""),
    props: jsonb("props").default({}),
    order: integer("order").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => {
    return {
        byDocumentOrder: index("blocks_by_doc_order_idx").on(table.documentId, table.order),
    }
});

export const semanticNodes = pgTable("semantic_nodes", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("userId").notNull().references(() => user.id, { onDelete: 'cascade' }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    metadata: jsonb("metadata").default({}),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => {
    return {
        byType: index("idx_nodes_type").on(table.type),
        searchTitle: index("idx_nodes_title").on(table.title),
        uniqueNode: uniqueIndex("idx_unique_node").on(table.userId, table.title, table.type),
    }
});

export const semanticEdges = pgTable("semantic_edges", {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceNodeId: uuid("source_id").notNull().references(() => semanticNodes.id, { onDelete: 'cascade' }),
    targetNodeId: uuid("target_id").notNull().references(() => semanticNodes.id, { onDelete: 'cascade' }),
    relationType: text("relation_type").notNull(),
    weight: integer("weight").default(1),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => {
    return {
        bySource: index("idx_edges_source").on(table.sourceNodeId),
        byTarget: index("idx_edges_target").on(table.targetNodeId),
    }
});

export const nodeSourceAnchors = pgTable("node_source_anchors", {
    id: uuid("id").defaultRandom().primaryKey(),
    nodeId: uuid("nodeId").notNull().references(() => semanticNodes.id, { onDelete: 'cascade' }),
    blockId: uuid("blockId").notNull().references(() => documentBlocks.id, { onDelete: 'cascade' }),
    startOffset: integer("start_offset").notNull(),
    endOffset: integer("end_offset").notNull(),
    provenance: text("provenance").notNull().default('AI'), // 'AI', 'USER', 'HYBRID', 'USER_REJECTED'
    isLocked: boolean("is_locked").notNull().default(false),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => {
    return {
        byBlock: index("idx_anchors_block").on(table.blockId),
        byNode: index("idx_anchors_node").on(table.nodeId),
    }
});

// Audit log for tracking all document changes
export const documentAuditLog = pgTable("document_audit_log", {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("documentId").notNull().references(() => documents.id, { onDelete: 'cascade' }),
    userId: text("userId").notNull().references(() => user.id),
    action: text("action").notNull(), // 'create', 'update', 'delete', 'archive', 'restore'
    fieldChanged: text("fieldChanged"), // 'title', 'content', 'icon', etc.
    oldValue: text("oldValue"),
    newValue: text("newValue"),
    version: integer("version").notNull(),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
}, (table) => {
    return {
        byDocument: index("audit_by_document_idx").on(table.documentId),
        byUser: index("audit_by_user_idx").on(table.userId),
        byTimestamp: index("audit_by_timestamp_idx").on(table.timestamp),
    }
});

// Relationships for Drizzle Query API
export const documentsRelations = relations(documents, ({ one, many }) => ({
    user: one(user, {
        fields: [documents.userId],
        references: [user.id],
    }),
    blocks: many(documentBlocks),
}));

export const documentBlocksRelations = relations(documentBlocks, ({ one, many }) => ({
    document: one(documents, {
        fields: [documentBlocks.documentId],
        references: [documents.id],
    }),
    anchors: many(nodeSourceAnchors),
}));

export const semanticNodesRelations = relations(semanticNodes, ({ one, many }) => ({
    user: one(user, {
        fields: [semanticNodes.userId],
        references: [user.id],
    }),
    anchors: many(nodeSourceAnchors),
    outgoingEdges: many(semanticEdges, { relationName: "source" }),
    incomingEdges: many(semanticEdges, { relationName: "target" }),
}));

export const nodeSourceAnchorsRelations = relations(nodeSourceAnchors, ({ one }) => ({
    node: one(semanticNodes, {
        fields: [nodeSourceAnchors.nodeId],
        references: [semanticNodes.id],
    }),
    block: one(documentBlocks, {
        fields: [nodeSourceAnchors.blockId],
        references: [documentBlocks.id],
    }),
}));

export const semanticEdgesRelations = relations(semanticEdges, ({ one }) => ({
    source: one(semanticNodes, {
        fields: [semanticEdges.sourceNodeId],
        references: [semanticNodes.id],
        relationName: "source",
    }),
    target: one(semanticNodes, {
        fields: [semanticEdges.targetNodeId],
        references: [semanticNodes.id],
        relationName: "target",
    }),
}));

export const waitlist = pgTable("waitlist", {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const qaItems = pgTable("qa_items", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("userId").notNull().references(() => user.id, { onDelete: 'cascade' }),
    text: text("text").notNull(),
    type: text("type").default("custom"), // what, why, how, custom
    status: text("status").notNull().default("unasked"), // unasked, asked
    answer: text("answer"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => {
    return {
        byUser: index("qa_items_user_idx").on(table.userId),
        byStatus: index("qa_items_status_idx").on(table.status),
    }
});
