/**
 * Query commands — event segmentation, funnels, retention, revenue, sessions.
 * All queries go through the Amplitude MCP server via query_dataset.
 *
 * Payload format matches the MCP server's query_dataset tool schema:
 *   { projectId, definition: { type, params: { ... } } }
 */
import { Command } from "commander";
export declare function registerQueryCommands(program: Command): void;
