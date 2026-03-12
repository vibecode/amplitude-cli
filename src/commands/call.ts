/**
 * Generic MCP tool invocation — escape hatch for tools the CLI
 * doesn't have dedicated convenience commands for.
 *
 * Usage:
 *   amp call <tool-name> '<json-args>'
 *   echo '<json>' | amp call <tool-name>
 */

import { Command } from "commander";
import { AmplitudeMcpClient } from "../mcp-client.js";
import { output, type OutputFormat } from "../utils/format.js";
import { extractMcpText } from "../utils/mcp-helpers.js";
import { handleError } from "../utils/errors.js";

export function registerCallCommand(program: Command): void {
  program
    .command("call <tool-name> [args-json]")
    .description("Call any MCP tool directly (escape hatch for unwrapped tools)")
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (toolName: string, argsJson: string | undefined, opts) => {
      try {
        let args: Record<string, unknown> = {};

        if (argsJson) {
          args = JSON.parse(argsJson);
        } else if (!process.stdin.isTTY) {
          const chunks: Buffer[] = [];
          for await (const chunk of process.stdin) {
            chunks.push(chunk as Buffer);
          }
          const raw = Buffer.concat(chunks).toString("utf-8").trim();
          if (raw) {
            args = JSON.parse(raw);
          }
        }

        const mcp = new AmplitudeMcpClient();
        const result = await mcp.callTool(toolName, args);
        output(extractMcpText(result), opts.format as OutputFormat);
      } catch (err) {
        if (err instanceof SyntaxError) {
          console.error("Error: Invalid JSON arguments.");
          console.error("Usage: amp call <tool-name> '{\"key\": \"value\"}'");
          process.exit(1);
        }
        handleError(err);
      }
    });
}
