# Rhizo (Jotion) Project Architecture

## Overview
**Rhizo** (formerly Jotion) is a sophisticated, AI-enhanced document and diagramming workspace. It combines a notion-style block editor (`BlockNote`) with an infinite canvas whiteboard (`Excalidraw`), underpinned by a robust local-first state management system and AI-powered capabilities.

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Shadcn UI (Radix Primitives)
- **Database**: PostgreSQL (Neon) via Drizzle ORM
- **Authentication**: Better Auth
- **AI**: Vercel AI SDK (OpenAI, Google)
- **State Management**: Zustand + Custom Sync Engine
- **Editor**: `@blocknote/react` (Text) + `@excalidraw/excalidraw` (Canvas)

## High-Level Architecture

### Directory Structure
- **`app/`**: Next.js App Router.
  - `(main)`: Application routes (protected).
  - `(marketing)`: Public landing pages.
  - `api/`: Server-side endpoints for AI and Auth.
- **`components/`**: UI & Feature Components.
  - `editor/`: Block editor implementation.
  - `canvas/`: Whiteboard integration points.
  - `excalidraw-canvas.tsx`: Main whiteboarding component.
  - `ai-chat-modal.tsx`: Central AI interface.
- **`lib/`**: Core utilities and business logic.
  - `ai/`: AI service wrappers.
  - `services/`: Backend service layer (Semantic search, data access).
  - `existence-engine.ts` & `write-queue.ts`: **Critical** state synchronization logic.
  - `cache/`: Performance optimization layer.
- **`db/`**: Database schema definition.
  - `schema.ts`: Core application schema.
  - `canvas-schema.ts`: Excalidraw-specific schema.

## Key Subsystems

### 1. The Dual-Editor System
The application hybridizes text and visual editing:
- **BlockNote** handles the linear document flow.
- **Excalidraw** handles the infinite canvas.
- **Integration**: The editors likely share context or can be embedded within each other.

### 2. State & Persistence Engine (`lib/`)
Unlike simple CRUD apps, Rhizo appears to have a sophisticated data synchronization layer:
- **Write Queue**: Manages data persistence to prevent blocking the UI and handle bursts of changes.
- **Existence Engine**: Tracks entity state/presence, possibly for collision detection or optimistic updates.
- **Cache**: A dedicated caching layer in `lib/cache` for performance.

### 3. AI Services (`lib/services`, `app/api`)
AI is treated as a first-class citizen with specific backend routes (`generate-chart`, `chat`) and likely semantic search capabilities (`lib/services/semantic`).

## Developer Guide - Where to find things?
| Feature | Key Files/Directories |
| :--- | :--- |
| **Auth Config** | `lib/auth.ts`, `app/api/auth/` |
| **DB Schema** | `db/schema.ts`, `db/canvas-schema.ts` |
| **Editor Logic** | `components/editor.tsx`, `components/editor/` |
| **Canvas Logic** | `components/excalidraw-canvas.tsx`, `lib/use-excalidraw-streaming.ts` |
| **AI Prompts** | `lib/ai/`, `app/api/generate-*/` |
| **Sync Logic** | `lib/existence-engine.ts`, `hooks/use-binding-sync.ts` |
