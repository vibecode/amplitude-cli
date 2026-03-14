/**
 * Shared MCP response helpers.
 */

import type { McpToolResult } from "../mcp-client.js";

/**
 * Extract text content from MCP tool result.
 * If the text is JSON, parse it; otherwise return the raw string.
 */
export function extractMcpText(result: McpToolResult): unknown {
  const texts = result.content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text!);

  if (texts.length === 0) return result;
  if (texts.length === 1) {
    try {
      return JSON.parse(texts[0]);
    } catch {
      return texts[0];
    }
  }
  return texts;
}

/**
 * Try to extract an editId from MCP query_dataset result.
 */
export function extractEditId(data: unknown): string | null {
  if (typeof data === "string") {
    const match = data.match(/editId["\s:]+["']?([a-zA-Z0-9_-]+)/);
    return match?.[1] || null;
  }
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    if (typeof obj.editId === "string") return obj.editId;
    if (typeof obj.chartEditId === "string") return obj.chartEditId;
    if (typeof obj.edit_id === "string") return obj.edit_id;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === "object" && val !== null) {
        const found = extractEditId(val);
        if (found) return found;
      }
    }
  }
  return null;
}
