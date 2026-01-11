
import { pgTable, text, integer, boolean, timestamp, uuid, index } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("emailVerified").notNull(),
    image: text("image"),
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
    password: text("password"),
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

// Self-reference foreign key definition needs to be careful, Drizzle handles it but strict constraint is good
// We can modify it later if needed.
