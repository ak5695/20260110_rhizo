CREATE TABLE "binding_existence_cache" (
	"binding_id" uuid PRIMARY KEY NOT NULL,
	"status" varchar(20) NOT NULL,
	"element_exists" boolean DEFAULT true NOT NULL,
	"element_deleted" boolean DEFAULT false NOT NULL,
	"mark_exists" boolean DEFAULT true NOT NULL,
	"last_verified_at" timestamp DEFAULT now() NOT NULL,
	"cache_version" integer DEFAULT 1 NOT NULL,
	"is_stale" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "binding_inconsistencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"binding_id" uuid,
	"type" varchar(50) NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"detected_by" varchar(20),
	"binding_status" varchar(20),
	"element_deleted" boolean,
	"mark_exists" boolean,
	"suggested_resolution" varchar(50),
	"resolution_confidence" real,
	"resolved_at" timestamp,
	"resolved_by" text,
	"resolution_action" varchar(50),
	"resolution_notes" text,
	"snapshot" jsonb
);
--> statement-breakpoint
CREATE TABLE "binding_status_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"binding_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"previous_status" varchar(20),
	"transition_type" varchar(50) NOT NULL,
	"transition_reason" text,
	"actor_id" text,
	"actor_type" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "canvas_change_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canvas_id" uuid NOT NULL,
	"change_type" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"change_data" jsonb NOT NULL,
	"previous_data" jsonb,
	"user_id" text NOT NULL,
	"session_id" text,
	"vector_clock" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvas_elements" (
	"id" text PRIMARY KEY NOT NULL,
	"canvas_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"x" real NOT NULL,
	"y" real NOT NULL,
	"width" real NOT NULL,
	"height" real NOT NULL,
	"angle" real DEFAULT 0,
	"data" jsonb NOT NULL,
	"compound_node_id" uuid,
	"z_index" integer DEFAULT 0 NOT NULL,
	"bound_block_id" uuid,
	"bound_semantic_node_id" uuid,
	"binding_type" varchar(50),
	"binding_metadata" jsonb,
	"binding_status" varchar(50) DEFAULT 'pending',
	"binding_provenance" varchar(50),
	"is_deleted" boolean DEFAULT false,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"name" text DEFAULT 'Untitled Canvas' NOT NULL,
	"description" text,
	"viewport_x" real DEFAULT 0,
	"viewport_y" real DEFAULT 0,
	"zoom" real DEFAULT 1,
	"version" integer DEFAULT 1 NOT NULL,
	"last_edited_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collaboration_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canvas_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"cursor_position" jsonb,
	"selected_elements" jsonb,
	"is_active" boolean DEFAULT true,
	"last_heartbeat" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"disconnected_at" timestamp,
	CONSTRAINT "collaboration_sessions_connection_id_unique" UNIQUE("connection_id")
);
--> statement-breakpoint
CREATE TABLE "compound_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canvas_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_compound_id" uuid,
	"bounding_box_x" real NOT NULL,
	"bounding_box_y" real NOT NULL,
	"bounding_box_width" real NOT NULL,
	"bounding_box_height" real NOT NULL,
	"bound_block_id" uuid,
	"bound_semantic_node_id" uuid,
	"binding_metadata" jsonb,
	"binding_status" varchar(50) DEFAULT 'pending',
	"binding_provenance" varchar(50),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_canvas_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"block_id" uuid,
	"text_range" jsonb,
	"semantic_node_id" uuid,
	"canvas_id" uuid NOT NULL,
	"element_id" text,
	"compound_node_id" uuid,
	"binding_type" varchar(50) NOT NULL,
	"direction" varchar(20) NOT NULL,
	"anchor_text" text,
	"semantic_label" text,
	"confidence" real,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"provenance" varchar(50) NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"review_notes" text,
	"current_status" varchar(20) DEFAULT 'visible' NOT NULL,
	"status_updated_at" timestamp,
	"status_updated_by" text,
	"last_synced_at" timestamp,
	"sync_errors" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_audit_log" (
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
	"userAgent" text
);
--> statement-breakpoint
CREATE TABLE "document_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"type" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb,
	"order" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"userId" text NOT NULL,
	"isArchived" boolean DEFAULT false NOT NULL,
	"parentDocumentId" uuid,
	"content" text,
	"coverImage" text,
	"icon" text,
	"isPublished" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"migrationVersion" integer DEFAULT 0 NOT NULL,
	"lastModifiedBy" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "node_source_anchors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nodeId" uuid NOT NULL,
	"blockId" uuid NOT NULL,
	"start_offset" integer NOT NULL,
	"end_offset" integer NOT NULL,
	"provenance" text DEFAULT 'AI' NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"text" text NOT NULL,
	"type" text DEFAULT 'custom',
	"status" text DEFAULT 'unasked' NOT NULL,
	"answer" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semantic_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"relation_type" text NOT NULL,
	"weight" integer DEFAULT 1,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semantic_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT true NOT NULL,
	"image" text,
	"password" text,
	"role" text DEFAULT 'user' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"banReason" text,
	"banExpires" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "binding_existence_cache" ADD CONSTRAINT "binding_existence_cache_binding_id_document_canvas_bindings_id_fk" FOREIGN KEY ("binding_id") REFERENCES "public"."document_canvas_bindings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "binding_inconsistencies" ADD CONSTRAINT "binding_inconsistencies_binding_id_document_canvas_bindings_id_fk" FOREIGN KEY ("binding_id") REFERENCES "public"."document_canvas_bindings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "binding_inconsistencies" ADD CONSTRAINT "binding_inconsistencies_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "binding_status_log" ADD CONSTRAINT "binding_status_log_binding_id_document_canvas_bindings_id_fk" FOREIGN KEY ("binding_id") REFERENCES "public"."document_canvas_bindings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "binding_status_log" ADD CONSTRAINT "binding_status_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_change_log" ADD CONSTRAINT "canvas_change_log_canvas_id_canvases_id_fk" FOREIGN KEY ("canvas_id") REFERENCES "public"."canvases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_change_log" ADD CONSTRAINT "canvas_change_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_elements" ADD CONSTRAINT "canvas_elements_canvas_id_canvases_id_fk" FOREIGN KEY ("canvas_id") REFERENCES "public"."canvases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_elements" ADD CONSTRAINT "canvas_elements_compound_node_id_compound_nodes_id_fk" FOREIGN KEY ("compound_node_id") REFERENCES "public"."compound_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_elements" ADD CONSTRAINT "canvas_elements_bound_semantic_node_id_semantic_nodes_id_fk" FOREIGN KEY ("bound_semantic_node_id") REFERENCES "public"."semantic_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvases" ADD CONSTRAINT "canvases_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvases" ADD CONSTRAINT "canvases_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvases" ADD CONSTRAINT "canvases_last_edited_by_user_id_fk" FOREIGN KEY ("last_edited_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_sessions" ADD CONSTRAINT "collaboration_sessions_canvas_id_canvases_id_fk" FOREIGN KEY ("canvas_id") REFERENCES "public"."canvases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_sessions" ADD CONSTRAINT "collaboration_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compound_nodes" ADD CONSTRAINT "compound_nodes_canvas_id_canvases_id_fk" FOREIGN KEY ("canvas_id") REFERENCES "public"."canvases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compound_nodes" ADD CONSTRAINT "compound_nodes_parent_compound_id_compound_nodes_id_fk" FOREIGN KEY ("parent_compound_id") REFERENCES "public"."compound_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compound_nodes" ADD CONSTRAINT "compound_nodes_bound_semantic_node_id_semantic_nodes_id_fk" FOREIGN KEY ("bound_semantic_node_id") REFERENCES "public"."semantic_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_canvas_bindings" ADD CONSTRAINT "document_canvas_bindings_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_canvas_bindings" ADD CONSTRAINT "document_canvas_bindings_semantic_node_id_semantic_nodes_id_fk" FOREIGN KEY ("semantic_node_id") REFERENCES "public"."semantic_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_canvas_bindings" ADD CONSTRAINT "document_canvas_bindings_canvas_id_canvases_id_fk" FOREIGN KEY ("canvas_id") REFERENCES "public"."canvases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_canvas_bindings" ADD CONSTRAINT "document_canvas_bindings_compound_node_id_compound_nodes_id_fk" FOREIGN KEY ("compound_node_id") REFERENCES "public"."compound_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_canvas_bindings" ADD CONSTRAINT "document_canvas_bindings_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_canvas_bindings" ADD CONSTRAINT "document_canvas_bindings_status_updated_by_user_id_fk" FOREIGN KEY ("status_updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_audit_log" ADD CONSTRAINT "document_audit_log_documentId_documents_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_audit_log" ADD CONSTRAINT "document_audit_log_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_blocks" ADD CONSTRAINT "document_blocks_documentId_documents_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_lastModifiedBy_user_id_fk" FOREIGN KEY ("lastModifiedBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_source_anchors" ADD CONSTRAINT "node_source_anchors_nodeId_semantic_nodes_id_fk" FOREIGN KEY ("nodeId") REFERENCES "public"."semantic_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_source_anchors" ADD CONSTRAINT "node_source_anchors_blockId_document_blocks_id_fk" FOREIGN KEY ("blockId") REFERENCES "public"."document_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_items" ADD CONSTRAINT "qa_items_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semantic_edges" ADD CONSTRAINT "semantic_edges_source_id_semantic_nodes_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."semantic_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semantic_edges" ADD CONSTRAINT "semantic_edges_target_id_semantic_nodes_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."semantic_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semantic_nodes" ADD CONSTRAINT "semantic_nodes_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cache_by_status_idx" ON "binding_existence_cache" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cache_by_stale_idx" ON "binding_existence_cache" USING btree ("is_stale");--> statement-breakpoint
CREATE INDEX "inconsistencies_by_binding_idx" ON "binding_inconsistencies" USING btree ("binding_id");--> statement-breakpoint
CREATE INDEX "inconsistencies_by_type_idx" ON "binding_inconsistencies" USING btree ("type");--> statement-breakpoint
CREATE INDEX "inconsistencies_by_resolved_idx" ON "binding_inconsistencies" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "status_log_by_binding_idx" ON "binding_status_log" USING btree ("binding_id");--> statement-breakpoint
CREATE INDEX "status_log_by_timestamp_idx" ON "binding_status_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "status_log_by_actor_idx" ON "binding_status_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "changelog_by_canvas_idx" ON "canvas_change_log" USING btree ("canvas_id","timestamp");--> statement-breakpoint
CREATE INDEX "changelog_by_entity_idx" ON "canvas_change_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "changelog_by_timestamp_idx" ON "canvas_change_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "elements_by_canvas_idx" ON "canvas_elements" USING btree ("canvas_id");--> statement-breakpoint
CREATE INDEX "elements_by_compound_idx" ON "canvas_elements" USING btree ("compound_node_id");--> statement-breakpoint
CREATE INDEX "elements_by_bound_block_idx" ON "canvas_elements" USING btree ("bound_block_id");--> statement-breakpoint
CREATE INDEX "elements_by_bound_node_idx" ON "canvas_elements" USING btree ("bound_semantic_node_id");--> statement-breakpoint
CREATE INDEX "elements_spatial_idx" ON "canvas_elements" USING btree ("canvas_id","x","y");--> statement-breakpoint
CREATE INDEX "canvas_by_document_idx" ON "canvases" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "canvas_by_user_idx" ON "canvases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_by_canvas_idx" ON "collaboration_sessions" USING btree ("canvas_id","is_active");--> statement-breakpoint
CREATE INDEX "sessions_by_user_idx" ON "collaboration_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_by_connection_idx" ON "collaboration_sessions" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "compounds_by_canvas_idx" ON "compound_nodes" USING btree ("canvas_id");--> statement-breakpoint
CREATE INDEX "compounds_by_parent_idx" ON "compound_nodes" USING btree ("parent_compound_id");--> statement-breakpoint
CREATE INDEX "compounds_by_bound_block_idx" ON "compound_nodes" USING btree ("bound_block_id");--> statement-breakpoint
CREATE INDEX "bindings_by_document_idx" ON "document_canvas_bindings" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "bindings_by_canvas_idx" ON "document_canvas_bindings" USING btree ("canvas_id");--> statement-breakpoint
CREATE INDEX "bindings_by_element_idx" ON "document_canvas_bindings" USING btree ("element_id");--> statement-breakpoint
CREATE INDEX "bindings_by_compound_idx" ON "document_canvas_bindings" USING btree ("compound_node_id");--> statement-breakpoint
CREATE INDEX "bindings_by_status_idx" ON "document_canvas_bindings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bindings_by_provenance_idx" ON "document_canvas_bindings" USING btree ("provenance");--> statement-breakpoint
CREATE INDEX "bindings_by_current_status_idx" ON "document_canvas_bindings" USING btree ("current_status");--> statement-breakpoint
CREATE INDEX "bindings_by_canvas_status_idx" ON "document_canvas_bindings" USING btree ("canvas_id","current_status");--> statement-breakpoint
CREATE INDEX "audit_by_document_idx" ON "document_audit_log" USING btree ("documentId");--> statement-breakpoint
CREATE INDEX "audit_by_user_idx" ON "document_audit_log" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "audit_by_timestamp_idx" ON "document_audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "blocks_by_doc_order_idx" ON "document_blocks" USING btree ("documentId","order");--> statement-breakpoint
CREATE INDEX "by_user_idx" ON "documents" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "by_user_parent_idx" ON "documents" USING btree ("userId","parentDocumentId");--> statement-breakpoint
CREATE INDEX "by_updated_idx" ON "documents" USING btree ("updatedAt");--> statement-breakpoint
CREATE INDEX "idx_anchors_block" ON "node_source_anchors" USING btree ("blockId");--> statement-breakpoint
CREATE INDEX "idx_anchors_node" ON "node_source_anchors" USING btree ("nodeId");--> statement-breakpoint
CREATE INDEX "qa_items_user_idx" ON "qa_items" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "qa_items_status_idx" ON "qa_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_edges_source" ON "semantic_edges" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_edges_target" ON "semantic_edges" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "idx_nodes_type" ON "semantic_nodes" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_nodes_title" ON "semantic_nodes" USING btree ("title");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_unique_node" ON "semantic_nodes" USING btree ("userId","title","type");