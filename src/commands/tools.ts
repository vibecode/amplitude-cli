/**
 * Tool introspection commands — list and describe MCP tools.
 * Fetches live schemas from the Amplitude MCP server.
 */

import { Command } from "commander";
import { AmplitudeMcpClient } from "../mcp-client.js";
import { output, type OutputFormat } from "../utils/format.js";
import { handleError } from "../utils/errors.js";

interface McpToolSchema {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface ToolsListResult {
  tools?: McpToolSchema[];
  result?: { tools?: McpToolSchema[] };
}

function extractToolsList(raw: unknown): McpToolSchema[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as ToolsListResult;
  return obj.tools || obj.result?.tools || [];
}

export function registerToolsCommands(program: Command): void {
  const tools = program
    .command("tools")
    .description("Discover available MCP tools and their schemas");

  tools
    .command("list")
    .description("List all available MCP tools")
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (opts) => {
      try {
        const mcp = new AmplitudeMcpClient();
        const result = await mcp.listTools();
        const toolsList = extractToolsList(result);

        if (opts.format === "json" || opts.format === "compact") {
          output(toolsList, opts.format as OutputFormat);
        } else {
          const summary = toolsList.map((t) => ({
            name: t.name,
            description: t.description || "",
          }));
          output(summary, opts.format as OutputFormat);
        }
      } catch (err) {
        handleError(err);
      }
    });

  tools
    .command("describe <tool-name>")
    .description("Show the input schema for a specific MCP tool")
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (toolName: string, opts) => {
      try {
        const mcp = new AmplitudeMcpClient();
        const result = await mcp.listTools();
        const toolsList = extractToolsList(result);
        const tool = toolsList.find((t) => t.name === toolName);

        if (!tool) {
          const available = toolsList.map((t) => t.name).join(", ");
          console.error(`Tool "${toolName}" not found.`);
          if (available) {
            console.error(`Available tools: ${available}`);
          }
          process.exit(1);
        }

        output(tool, opts.format as OutputFormat);
      } catch (err) {
        handleError(err);
      }
    });
}
