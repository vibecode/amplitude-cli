/**
 * Shared MCP response helpers.
 */
import type { McpToolResult } from "../mcp-client.js";
/**
 * Extract text content from MCP tool result.
 * If the text is JSON, parse it; otherwise return the raw string.
 */
export declare function extractMcpText(result: McpToolResult): unknown;
/**
 * Try to extract an editId from MCP query_dataset result.
 */
export declare function extractEditId(data: unknown): string | null;
