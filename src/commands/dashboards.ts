/**
 * Dashboard commands — search, create, and manage Amplitude dashboards.
 * All via MCP server (OAuth).
 */

import { Command } from "commander";
import { AmplitudeMcpClient } from "../mcp-client.js";
import { output, type OutputFormat } from "../utils/format.js";
import { extractMcpText } from "../utils/mcp-helpers.js";
import { handleError } from "../utils/errors.js";

export function registerDashboardCommands(program: Command): void {
  const dashboards = program
    .command("dashboards")
    .description("Create and manage Amplitude dashboards");

  dashboards
    .command("search <query>")
    .description("Search for existing dashboards")
    .option("--limit <n>", "Max results", "10")
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (query, opts) => {
      try {
        const mcp = new AmplitudeMcpClient();
        const result = await mcp.search(query, ["DASHBOARD"], parseInt(opts.limit));
        output(extractMcpText(result), opts.format as OutputFormat);
      } catch (err) {
        handleError(err);
      }
    });

  dashboards
    .command("get <dashboard-id>")
    .description("Get full dashboard definition and contents")
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (dashboardId, opts) => {
      try {
        const mcp = new AmplitudeMcpClient();
        const result = await mcp.getDashboard(dashboardId);
        output(extractMcpText(result), opts.format as OutputFormat);
      } catch (err) {
        handleError(err);
      }
    });

  dashboards
    .command("create")
    .description("Create a dashboard from a JSON definition (reads from stdin or --definition)")
    .requiredOption("--name <name>", "Dashboard name")
    .option("--description <desc>", "Dashboard description")
    .option("--definition <json>", "Dashboard rows/layout as JSON string")
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (opts) => {
      try {
        let rows: unknown[];

        if (opts.definition) {
          rows = JSON.parse(opts.definition);
        } else {
          const chunks: Buffer[] = [];
          for await (const chunk of process.stdin) {
            chunks.push(chunk as Buffer);
          }
          rows = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        }

        if (!Array.isArray(rows)) {
          console.error("Error: Dashboard definition must be a JSON array of rows.");
          process.exit(1);
        }

        const mcp = new AmplitudeMcpClient();
        console.error(`Creating dashboard "${opts.name}"...`);
        const result = await mcp.createDashboard(opts.name, rows, opts.description);
        output(extractMcpText(result), opts.format as OutputFormat);
      } catch (err) {
        handleError(err);
      }
    });
}
