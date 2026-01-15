import { useRef, useEffect } from "react"
import type { MutableRefObject } from "react"
import {
    parseCompactExcalidrawStreaming,
    parseCompactExcalidraw,
    convertCompactToExcalidraw
} from "./excalidraw-converter"

// Mock types
interface ToolCall {
    toolCallId: string
    toolName: string
    input: unknown
    state: "input-streaming" | "input-available" | "output-available" | "output-error"
}

interface MessagePart {
    type: string
    [key: string]: any
}

interface Message {
    parts?: MessagePart[]
}

/**
 * Example Hook: usage in a Chat Component to handle streaming Excalidraw updates
 */
export function useExcalidrawStreaming({
    messages,
    setExcalidrawElements,
}: {
    messages: Message[]
    setExcalidrawElements: (elements: any[]) => void
}) {
    // Track the last processed JSON to avoid redundant work
    const lastProcessedJsonRef = useRef<Map<string, string>>(new Map())

    // Debounce reference
    const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pendingElementsRef = useRef<any[] | null>(null)
    const lastElementCountRef = useRef<number>(0)

    const STREAMING_DEBOUNCE_MS = 250

    // 1. Listen for message updates (Streaming)
    useEffect(() => {
        // Only process the last message for performance
        const lastMessage = messages[messages.length - 1]
        if (!lastMessage?.parts) return

        lastMessage.parts.forEach((part) => {
            // Check for display_excalidraw tool call
            if (part.type === "tool-display_excalidraw" || (part.toolName === "display_excalidraw")) {
                const toolPart = part as any
                const { toolCallId, state, input } = toolPart

                // We need 'elements' string input
                if (!input?.elements) return

                const elementsJson = input.elements as string

                // Skip if JSON hasn't changed
                const lastJson = lastProcessedJsonRef.current.get(toolCallId)
                if (lastJson === elementsJson) return

                // --- STREAMING CASE (Input is still being generated) ---
                if (state === "input-streaming" || state === "input-available") {

                    // A. Parse partial JSON safely
                    const { elements: compactElements } = parseCompactExcalidrawStreaming(elementsJson)

                    if (compactElements.length === 0) return

                    // B. Convert to Excalidraw format
                    const excalidrawElements = convertCompactToExcalidraw(compactElements)

                    // C. Debounce updates to Canvas
                    pendingElementsRef.current = excalidrawElements

                    if (!debounceTimeoutRef.current) {
                        debounceTimeoutRef.current = setTimeout(() => {
                            const pending = pendingElementsRef.current
                            debounceTimeoutRef.current = null
                            pendingElementsRef.current = null

                            // Optimize: Only update if element count changed (or other criteria)
                            if (pending && pending.length > 0 &&
                                pending.length !== lastElementCountRef.current) {

                                lastElementCountRef.current = pending.length
                                setExcalidrawElements(pending)

                                lastProcessedJsonRef.current.set(toolCallId, elementsJson)
                                console.log(`[Streaming] Rendered ${pending.length} elements`)
                            }
                        }, STREAMING_DEBOUNCE_MS)
                    }
                }

                // --- FINAL CASE (Tool call is complete) ---
                else if (state === "output-available") {
                    // Clear interaction
                    if (debounceTimeoutRef.current) {
                        clearTimeout(debounceTimeoutRef.current)
                        debounceTimeoutRef.current = null
                    }

                    // Use standard parser for final result (stricter)
                    const { elements: compactElements, error } = parseCompactExcalidraw(elementsJson)

                    if (!error && compactElements.length > 0) {
                        const excalidrawElements = convertCompactToExcalidraw(compactElements)
                        setExcalidrawElements(excalidrawElements)
                        lastProcessedJsonRef.current.set(toolCallId, elementsJson)
                        console.log("[Final] Rendered Excalidraw Diagram")
                    }
                }
            }
        })
    }, [messages, setExcalidrawElements])
}
