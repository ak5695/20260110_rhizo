import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: openai("gpt-4-turbo"),
    messages,
    system: `You are a helpful AI writing assistant integrated into a Notion-like document editor.

Your role is to help users:
- Write and improve content
- Generate ideas and outlines
- Continue writing from their existing text
- Refine and polish their writing
- Create structured content (lists, tables, etc.)

Keep responses concise, clear, and directly useful for document writing.
When generating content, format it in a way that's ready to insert into a document.`,
  });

  return result.toDataStreamResponse();
}
