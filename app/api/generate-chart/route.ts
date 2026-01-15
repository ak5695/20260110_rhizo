import { google } from "@ai-sdk/google";
import { streamText, tool } from "ai";
import { getExcalidrawSystemPrompt } from "@/lib/ai-excalidraw/system-prompts-excalidraw";
import { z } from "zod";

export const maxDuration = 60;

export async function POST(req: Request) {
    const { messages } = await req.json();

    const result = await streamText({
        model: google("gemini-2.0-flash"),
        messages,
        system: getExcalidrawSystemPrompt("Gemini"),
        tools: {
            display_excalidraw: tool({
                description: `Render Excalidraw diagram. Use COMPACT JSON to save tokens.
Keys: i=id, t=type(r=rect,el=ellipse,d=diamond,a=arrow,tx=text,ln=line,fr=frame), x,y,w,h, l=label, bg=fill, sc=stroke, g=group.
Style: ss=style(solid/dashed), sw=width, fs=fontSize, ta=align.
Arrow: si=startId, ei=endId, sa/ea=head.
Example: {"e":[{"i":"n1","t":"r","x":0,"y":0,"w":100,"h":50,"l":"Node"}]}
After calling, provide brief explanation using [Label](#id) links.`,
                parameters: z.object({
                    elements: z
                        .string()
                        .describe(
                            "Compact JSON: {\"e\":[...elements]} with abbreviated keys",
                        ),
                }),
                // @ts-expect-error - Type inference for tool execute is failing uniquely in build
                execute: async ({ elements }: { elements: string }) => {
                    try {
                        const parsed = JSON.parse(elements)
                        // Support both compact {e:[...]} and full format
                        const elementList = parsed.e || parsed.elements || parsed
                        const shapes = elementList.filter((e: { t?: string; type?: string }) =>
                            (e.t || e.type) !== 'a' && (e.t || e.type) !== 'arrow'
                        )

                        if (shapes.length > 0) {
                            const nodeLinks = shapes.map((e: { i?: string; id?: string; l?: string; label?: string; t?: string; type?: string }) =>
                                `[${e.l || e.label || e.t || e.type}](#${e.i || e.id})`
                            ).join(', ')
                            return `Excalidraw diagram rendered with ${shapes.length} shapes. Now use [Label](#id) format to explain key elements. Elements: ${nodeLinks}.`
                        }
                        return "Excalidraw diagram rendered successfully."
                    } catch {
                        return "Excalidraw diagram rendered successfully."
                    }
                },
            })
        },
        // Force the model to use the tool to generate the diagram
        toolChoice: "required",
    });

    return result.toTextStreamResponse();
}
