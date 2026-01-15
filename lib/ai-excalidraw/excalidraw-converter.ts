/**
 * Converts compact element format from AI to Excalidraw-compatible format
 * 
 * COMPACT FORMAT KEYS:
 * Basic:
 * - i: id
 * - t: type (r=rectangle, el=ellipse, d=diamond, a=arrow, tx=text, ln=line, fr=frame)
 * - x, y: position
 * - w, h: width, height
 * - l: label
 * 
 * Colors:
 * - sc: strokeColor
 * - bg: backgroundColor
 * 
 * Arrows:
 * - si: startId (source element)
 * - ei: endId (target element)
 * - sa: startArrowhead (arrow/bar/circle/triangle/none)
 * - ea: endArrowhead (arrow/bar/circle/triangle/none)
 * 
 * Styles:
 * - ss: strokeStyle (solid/dashed/dotted)
 * - sw: strokeWidth (1-4)
 * - ro: roughness (0=sharp, 1=artist, 2=cartoonist)
 * - op: opacity (0-100)
 * - rn: roundness type (1=legacy, 2=proportional, 3=adaptive)
 * 
 * Text:
 * - fs: fontSize
 * - ff: fontFamily (1=hand, 2=normal, 3=code)
 * - ta: textAlign (left/center/right)
 * 
 * Grouping:
 * - g: groupId (elements with same g value move together)
 */

export interface CompactElement {
    i: string        // id
    t: string        // type: r/el/d/a/tx/ln/fr
    x?: number
    y?: number
    w?: number       // width
    h?: number       // height
    l?: string       // label
    sc?: string      // strokeColor
    bg?: string      // backgroundColor
    si?: string      // startId (for arrows)
    ei?: string      // endId (for arrows)
    sa?: string      // startArrowhead
    ea?: string      // endArrowhead
    ss?: string      // strokeStyle: solid/dashed/dotted
    sw?: number      // strokeWidth
    ro?: number      // roughness: 0/1/2
    op?: number      // opacity: 0-100
    rn?: number      // roundness type
    fs?: number      // fontSize
    ff?: number      // fontFamily: 1/2/3
    ta?: string      // textAlign
    g?: string       // groupId
    ch?: string[]    // children IDs (for frames/containers) - V2 semantic format
}

interface CompactDiagram {
    e: CompactElement[]  // elements
}

// Type mapping from compact to full
const TYPE_MAP: Record<string, string> = {
    'r': 'rectangle',
    'el': 'ellipse',
    'd': 'diamond',
    'a': 'arrow',
    'tx': 'text',
    'ln': 'line',
    'fr': 'frame',   // NEW: Frame
    // Also support full names
    'rectangle': 'rectangle',
    'ellipse': 'ellipse',
    'diamond': 'diamond',
    'arrow': 'arrow',
    'text': 'text',
    'line': 'line',
    'frame': 'frame',
}

// Arrowhead mapping
const ARROWHEAD_MAP: Record<string, string | null> = {
    'arrow': 'arrow',
    'bar': 'bar',
    'circle': 'circle',
    'triangle': 'triangle',
    'none': null,
    '': null,
}

let seedCounter = 1

function generateSeed(): number {
    return seedCounter++
}

// =============================================================================
// V2 AUTO-LAYOUT FUNCTIONS
// Automatically calculate positions and sizes based on semantic structure
// =============================================================================

/**
 * Calculate text width based on character count
 * Chinese characters are wider than English
 */
function calculateTextWidth(text: string): number {
    if (!text) return 120

    let width = 0
    for (const char of text) {
        // Chinese/Japanese/Korean characters are wider
        if (/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(char)) {
            width += 18
        } else {
            width += 10
        }
    }

    // Add padding (left + right)
    width += 40

    // Minimum width
    return Math.max(120, width)
}

/**
 * Calculate node height based on content
 */
function calculateNodeHeight(text: string, width: number): number {
    if (!text) return 60

    const charWidth = 10
    const charsPerLine = Math.floor((width - 40) / charWidth)
    const lines = Math.ceil(text.length / charsPerLine)

    // Base height + extra for multiple lines
    return Math.max(60, 30 + lines * 24)
}

/**
 * Auto-layout elements that don't have coordinates
 * Uses a simple top-to-bottom flow layout
 * 
 * V2 Semantic Format: AI provides structure only (no x,y,w,h)
 * This function calculates all positions and sizes automatically
 */
export function autoLayoutElements(elements: CompactElement[]): CompactElement[] {
    // Quick check: if most elements have coordinates, skip auto-layout
    const elementsWithCoords = elements.filter(el =>
        el.x !== undefined && el.y !== undefined && el.t !== 'a'
    )
    const nonArrowElements = elements.filter(el => el.t !== 'a')

    // If more than 50% of elements have coordinates, assume V1 format - don't modify
    if (nonArrowElements.length > 0 && elementsWithCoords.length > nonArrowElements.length * 0.5) {
        console.log('[AutoLayout] Skipping - elements already have coordinates (V1 format)')
        return elements
    }

    console.log('[AutoLayout] Applying automatic layout (V2 semantic format)')

    const elementsById = new Map<string, CompactElement>()
    const childToParent = new Map<string, string>()
    const processedIds = new Set<string>()

    // First pass: index elements and build child-parent map
    for (const el of elements) {
        elementsById.set(el.i, el)

        if (el.ch) {
            for (const childId of el.ch) {
                childToParent.set(childId, el.i)
            }
        }
    }

    // Layout configuration
    const PADDING = 60
    const VERTICAL_GAP = 100
    const HORIZONTAL_GAP = 120
    const FRAME_TITLE_HEIGHT = 60
    const START_X = 100
    const START_Y = 100

    /**
     * Recursively layout an element and its children
     * Returns the bounding box of the laid out element
     */
    function layoutElement(el: CompactElement, startX: number, startY: number): {
        x: number, y: number, w: number, h: number, bottom: number
    } {
        if (processedIds.has(el.i)) {
            return { x: el.x || 0, y: el.y || 0, w: el.w || 120, h: el.h || 60, bottom: (el.y || 0) + (el.h || 60) }
        }
        processedIds.add(el.i)

        const type = TYPE_MAP[el.t] || el.t

        // Calculate text-based width
        const textWidth = calculateTextWidth(el.l || '')
        const textHeight = calculateNodeHeight(el.l || '', textWidth)

        if (type === 'frame' && el.ch && el.ch.length > 0) {
            // Frame with children - layout children first
            const children = el.ch
                .map(id => elementsById.get(id))
                .filter(Boolean) as CompactElement[]

            // Layout children vertically inside the frame
            let childY = startY + FRAME_TITLE_HEIGHT
            let maxChildRight = startX + PADDING
            const childStartX = startX + PADDING

            for (const child of children) {
                const childBounds = layoutElement(child, childStartX, childY)
                maxChildRight = Math.max(maxChildRight, childBounds.x + childBounds.w)
                childY = childBounds.bottom + VERTICAL_GAP
            }

            // Calculate frame bounds based on children
            const frameWidth = Math.max(maxChildRight - startX + PADDING, textWidth + PADDING * 2)
            const frameHeight = childY - startY - VERTICAL_GAP + PADDING

            el.x = startX
            el.y = startY
            el.w = frameWidth
            el.h = Math.max(frameHeight, 150)

            return {
                x: el.x,
                y: el.y,
                w: el.w,
                h: el.h,
                bottom: el.y + el.h
            }

        } else if (type === 'arrow') {
            // Arrows don't need layout - they connect other elements
            return { x: 0, y: 0, w: 0, h: 0, bottom: startY }

        } else {
            // Regular element (rectangle, diamond, ellipse, text)
            el.x = startX
            el.y = startY
            el.w = textWidth
            el.h = textHeight

            return {
                x: el.x,
                y: el.y,
                w: el.w,
                h: el.h,
                bottom: el.y + el.h
            }
        }
    }

    // Find root elements (not children of any frame)
    const rootElements = elements.filter(el =>
        !childToParent.has(el.i) && el.t !== 'a'
    )

    // Layout root elements vertically
    let currentY = START_Y

    for (const el of rootElements) {
        const bounds = layoutElement(el, START_X, currentY)
        currentY = bounds.bottom + VERTICAL_GAP
    }

    return elements
}


/**
 * Parse compact JSON format from AI
 * Handles common issues like comments and trailing commas
 */
export function parseCompactExcalidraw(json: string): { elements: CompactElement[], error?: string } {
    try {
        // Step 1: Strip JavaScript-style comments (// ...) that AI sometimes adds
        // This regex removes // comments but is careful not to break URLs with //
        let cleanedJson = json
            .split('\n')
            .map(line => {
                // Find // that's not inside a string
                // Simple approach: remove everything after // if not preceded by :
                const commentMatch = line.match(/^(.*?)(?<![:\\"'])\/\/.*$/)
                return commentMatch ? commentMatch[1] : line
            })
            .join('\n')

        // Step 2: Try parsing directly first
        try {
            const parsed = JSON.parse(cleanedJson)
            return extractElements(parsed)
        } catch {
            // Step 3: If that fails, try jsonrepair
            try {
                const { jsonrepair } = require('jsonrepair')
                const repaired = jsonrepair(cleanedJson)
                const parsed = JSON.parse(repaired)
                console.log("[parseCompactExcalidraw] Used jsonrepair to fix malformed JSON")
                return extractElements(parsed)
            } catch (repairErr) {
                return { elements: [], error: `JSON parse error after repair attempt: ${repairErr}` }
            }
        }
    } catch (err) {
        return { elements: [], error: `JSON parse error: ${err}` }
    }
}

function extractElements(parsed: any): { elements: CompactElement[], error?: string } {
    // Support both { e: [...] } and direct array
    if (parsed.e && Array.isArray(parsed.e)) {
        return { elements: parsed.e }
    }
    if (Array.isArray(parsed)) {
        return { elements: parsed }
    }
    if (parsed.elements && Array.isArray(parsed.elements)) {
        return { elements: parsed.elements }
    }

    return { elements: [], error: "Invalid format: expected { e: [...] } or array" }
}

/**
 * Parse compact JSON format from AI during streaming
 * Extracts COMPLETE element objects from potentially incomplete JSON
 * This allows progressive rendering as elements are streamed
 */
export function parseCompactExcalidrawStreaming(json: string): { elements: CompactElement[], isComplete: boolean } {
    if (!json || json.trim().length === 0) {
        return { elements: [], isComplete: false }
    }

    // Step 1: Strip comments
    let cleanedJson = json
        .split('\n')
        .map(line => {
            const commentMatch = line.match(/^(.*?)(?<![:\\"'])\/\/.*$/)
            return commentMatch ? commentMatch[1] : line
        })
        .join('\n')

    // Step 2: Try to parse as complete JSON first
    try {
        const parsed = JSON.parse(cleanedJson)
        const result = extractElements(parsed)
        return { elements: result.elements, isComplete: true }
    } catch {
        // JSON is incomplete, try to extract complete elements
    }

    // Step 3: Use jsonrepair to try to fix incomplete JSON
    try {
        const { jsonrepair } = require('jsonrepair')
        const repaired = jsonrepair(cleanedJson)
        const parsed = JSON.parse(repaired)
        const result = extractElements(parsed)
        // jsonrepair succeeded but original was incomplete
        return { elements: result.elements, isComplete: false }
    } catch {
        // jsonrepair failed, fall back to regex extraction
    }

    // Step 4: Regex-based extraction for very incomplete JSON
    // Find complete element objects like {"i":"node1","t":"r",...}
    const elements: CompactElement[] = []

    // Match complete objects with at least "i" and "t" properties
    // This regex finds objects that have been fully closed with }
    const elementRegex = /\{[^{}]*"i"\s*:\s*"[^"]+"\s*[^{}]*"t"\s*:\s*"[^"]+"\s*[^{}]*\}/g
    const altElementRegex = /\{[^{}]*"t"\s*:\s*"[^"]+"\s*[^{}]*"i"\s*:\s*"[^"]+"\s*[^{}]*\}/g

    const matches = cleanedJson.match(elementRegex) || []
    const altMatches = cleanedJson.match(altElementRegex) || []

    const allMatches = Array.from(new Set([...matches, ...altMatches]))

    for (const match of allMatches) {
        try {
            const element = JSON.parse(match)
            if (element.i && element.t) {
                elements.push(element)
            }
        } catch {
            // Skip malformed elements
        }
    }

    return { elements, isComplete: false }
}

/**
 * Convert compact elements to Excalidraw native format
 */
export function convertCompactToExcalidraw(compactElements: CompactElement[]): any[] {
    // V2: Use Dagre for intelligent graph layout
    const { layoutWithDagre } = require('./auto-layout-dagre')
    const layoutedElements = layoutWithDagre(compactElements)

    const elements: any[] = []
    const elementMap = new Map<string, CompactElement>()

    // Track which arrows connect to which shapes (for boundElements)
    const shapeArrowBindings = new Map<string, string[]>()

    // Track group IDs
    const groupMap = new Map<string, string>()

    const getGroupId = (g?: string): string[] => {
        if (!g) return []
        if (!groupMap.has(g)) {
            groupMap.set(g, `group_${generateSeed()}`)
        }
        return [groupMap.get(g)!]
    }

    // First pass: collect all elements and arrow bindings
    for (const el of layoutedElements) {
        // Skip incomplete elements during streaming (no type field yet)
        if (!el.t || el.t === 'undefined' || el.t === 'null') {
            continue // Skip silently during streaming
        }

        elementMap.set(el.i, el)

        let type = TYPE_MAP[el.t] || el.t
        // Fallback for unknown types to avoid empty canvas
        if (!['rectangle', 'ellipse', 'diamond', 'arrow', 'text', 'line', 'frame'].includes(type)) {
            console.warn(`[Converter] Unknown type '${el.t}', defaulting to 'rectangle'`)
            type = 'rectangle'
        }

        if (type === "arrow") {
            if (el.si) {
                const existing = shapeArrowBindings.get(el.si) || []
                existing.push(el.i)
                shapeArrowBindings.set(el.si, existing)
            }
            if (el.ei) {
                const existing = shapeArrowBindings.get(el.ei) || []
                existing.push(el.i)
                shapeArrowBindings.set(el.ei, existing)
            }
        }
    }

    // Layered storage to ensure correct rendering order (Z-Index)
    const layerFrames: any[] = [] // Bottom: Frames/Containers
    const layerArrows: any[] = [] // Low: Arrows
    const layerShapes: any[] = [] // Middle: Shapes
    const layerTexts: any[] = []  // Top: Texts

    for (const el of layoutedElements) {
        const baseProps = {
            angle: 0,
            strokeColor: el.sc || "#1e1e1e",
            backgroundColor: el.bg || "transparent",
            fillStyle: "solid",
            strokeWidth: el.sw || 2,
            strokeStyle: el.ss || "solid",
            roughness: el.ro ?? 1,
            opacity: el.op ?? 100,
            groupIds: getGroupId(el.g), // Apply Group ID
            frameId: null,
            roundness: el.rn ? { type: el.rn } : { type: 3 },
            seed: generateSeed(),
            version: 1,
            versionNonce: generateSeed(),
            isDeleted: false,
            updated: Date.now(),
            link: null,
            locked: false,
        }

        let type = TYPE_MAP[el.t] || el.t
        if (!['rectangle', 'ellipse', 'diamond', 'arrow', 'text', 'line', 'frame'].includes(type)) {
            type = 'rectangle'
        }

        if (type === "frame") {
            // Frame Element (Container) - visual representation using a styled rectangle

            // Auto-group: If frame has label but no group ID, create one to bind them
            let frameGroupIds = baseProps.groupIds
            if (frameGroupIds.length === 0 && el.l) {
                frameGroupIds = [`group_auto_${el.i}`]
            }

            layerFrames.push({
                ...baseProps,
                groupIds: frameGroupIds, // Use the (potentially auto) group IDs
                id: el.i,
                type: "rectangle",
                x: el.x || 0,
                y: el.y || 0,
                width: el.w || 300,
                height: el.h || 300,
                backgroundColor: el.bg || "transparent",
                strokeStyle: "dashed", // Visual hint it's a container
                strokeWidth: 2,
                boundElements: null,
            })

            // Add a label for the frame if provided
            if (el.l) {
                layerTexts.push({
                    ...baseProps,
                    groupIds: frameGroupIds, // Use the same group IDs
                    id: `${el.i}-label`,
                    type: "text",
                    x: (el.x || 0) + 10,
                    y: (el.y || 0) - 30, // Label above frame
                    width: 100, // auto
                    height: 25,
                    text: el.l,
                    fontSize: 20,
                    fontFamily: 1,
                    textAlign: "left",
                    verticalAlign: "top",
                    containerId: null, // Don't bind containerId, just group them
                    originalText: el.l,
                    lineHeight: 1.25,
                    boundElements: null,
                })
            }
        } else if (type === "arrow" || type === "line") {
            const startEl = el.si ? elementMap.get(el.si) : null
            const endEl = el.ei ? elementMap.get(el.ei) : null

            let startX = el.x || 0
            let startY = el.y || 0
            let endX = startX + 100
            let endY = startY + 100

            if (startEl && endEl) {
                const startCenterX = (startEl.x || 0) + (startEl.w || 150) / 2
                const endCenterX = (endEl.x || 0) + (endEl.w || 150) / 2

                startX = startCenterX
                startY = (startEl.y || 0) + (startEl.h || 60)
                endX = endCenterX
                endY = endEl.y || 0
            }

            // Add to ARROW layer (Bottom)
            layerArrows.push({
                ...baseProps,
                id: el.i,
                type: type,
                x: startX,
                y: startY,
                width: endX - startX,
                height: endY - startY,
                points: [[0, 0], [endX - startX, endY - startY]],
                startBinding: startEl ? {
                    elementId: el.si!,
                    focus: 0,
                    gap: 1,
                    fixedPoint: null
                } : null,
                endBinding: endEl ? {
                    elementId: el.ei!,
                    focus: 0,
                    gap: 1,
                    fixedPoint: null
                } : null,
                lastCommittedPoint: null,
                startArrowhead: el.sa ? (ARROWHEAD_MAP[el.sa] ?? null) : null,
                endArrowhead: type === "arrow" ? (el.ea ? (ARROWHEAD_MAP[el.ea] ?? "arrow") : "arrow") : null,
                boundElements: null,
            })
        } else if (type === "text") {
            // Standalone text (Top)
            layerTexts.push({
                ...baseProps,
                id: el.i,
                type: "text",
                x: el.x || 0,
                y: el.y || 0,
                width: el.w || 100,
                height: el.h || 25,
                text: el.l || "Text",
                fontSize: el.fs || 20,
                fontFamily: el.ff || 1,
                textAlign: el.ta || "center",
                verticalAlign: "middle",
                containerId: null,
                originalText: el.l || "Text",
                lineHeight: 1.25,
                boundElements: null,
            })
        } else {
            // Shape elements (rectangle, ellipse, diamond)
            const connectedArrows = shapeArrowBindings.get(el.i) || []
            const boundElements = connectedArrows.map(arrowId => ({ id: arrowId, type: "arrow" }))

            // Handle label as bound text
            let textElement = null
            if (el.l) {
                const textId = `${el.i}-text`

                // Add text element to boundElements
                boundElements.push({ id: textId, type: "text" })

                // Calculate centered position for text
                const fontSize = el.fs || 20
                const lineHeight = 1.25
                const text = el.l || ""

                // Better estimation: English ~0.6, CJK ~1.0 + safety buffer
                // We use a simpler heuristic: average 1 em per char for safety
                const estimatedTextWidth = text.length * fontSize * 1.0 + 10
                const estimatedTextHeight = fontSize * lineHeight

                // Center calculations
                const shapeX = el.x || 0
                const shapeY = el.y || 0
                const shapeW = el.w || 150
                const shapeH = el.h || 60

                const textX = shapeX + (shapeW - estimatedTextWidth) / 2
                const textY = shapeY + (shapeH - estimatedTextHeight) / 2

                // Add to TEXT layer - WITH GROUP ID if shape has one
                textElement = {
                    ...baseProps,
                    id: textId,
                    type: "text",
                    x: textX,
                    y: textY,
                    width: estimatedTextWidth,
                    height: estimatedTextHeight,
                    text: text,
                    fontSize: fontSize,
                    fontFamily: el.ff || 1,
                    textAlign: "center",
                    verticalAlign: "top", // Changed from middle to top per user request
                    containerId: el.i,
                    originalText: text,
                    lineHeight: lineHeight,
                    boundElements: null,
                }
            }

            // Add to SHAPE layer (Middle)
            // autoResize tells Excalidraw to recalculate container bounds based on text
            layerShapes.push({
                ...baseProps,
                id: el.i,
                type: type,
                x: el.x || 0,
                y: el.y || 0,
                width: el.w || 150,
                height: el.h || 60,
                boundElements: boundElements.length > 0 ? boundElements : null,
                // Enable auto-resize so Excalidraw adjusts container to fit text
                autoResize: el.l ? true : false,
            })

            // Push TEXT AFTER (so it renders on top)
            if (textElement) {
                layerTexts.push(textElement)
            }
        }
    }

    // Merge layers: Frames (Bottom) -> Arrows -> Shapes -> Texts (Top)
    return [...layerFrames, ...layerArrows, ...layerShapes, ...layerTexts]
}

// Legacy function for backward compatibility
export function convertToExcalidrawElements(simpleElements: any[]): any[] {
    // Convert old format to compact format
    const compact: CompactElement[] = simpleElements.map(el => ({
        i: el.id || el.i,
        t: el.type || el.t,
        x: el.x,
        y: el.y,
        w: el.width || el.w,
        h: el.height || el.h,
        l: el.label || el.l,
        sc: el.strokeColor || el.sc,
        bg: el.backgroundColor || el.bg,
        si: el.startId || el.si,
        ei: el.endId || el.ei,
        ss: el.strokeStyle || el.ss,
        sw: el.strokeWidth || el.sw,
        ro: el.roughness ?? el.ro,
        op: el.opacity ?? el.op,
    }))
    return convertCompactToExcalidraw(compact)
}
