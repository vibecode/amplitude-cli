/**
 * Chart commands — search, create, query, and manage Amplitude charts.
 * All via MCP server (OAuth).
 */

import { Command } from "commander";
import { AmplitudeMcpClient } from "../mcp-client.js";
import { output, type OutputFormat } from "../utils/format.js";
import { extractMcpText, extractEditId } from "../utils/mcp-helpers.js";
import { handleError } from "../utils/errors.js";

export function registerChartCommands(program: Command): void {
  const charts = program
    .command("charts")
    .description("Create and manage Amplitude charts");

  charts
    .command("search <query>")
    .description("Search for existing charts in Amplitude")
    .option("--limit <n>", "Max results", "10")
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (query, opts) => {
      try {
        const mcp = new AmplitudeMcpClient();
        const result = await mcp.search(query, ["CHART"], parseInt(opts.limit));
        output(extractMcpText(result), opts.format as OutputFormat);
      } catch (err) {
        handleError(err);
      }
    });

  charts
    .command("get <chart-id...>")
    .description("Get full chart definitions by ID")
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (chartIds, opts) => {
      try {
        const mcp = new AmplitudeMcpClient();
        const result = await mcp.getCharts(chartIds);
        output(extractMcpText(result), opts.format as OutputFormat);
      } catch (err) {
        handleError(err);
      }
    });

  charts
    .command("query <chart-id>")
    .description("Query data from an existing chart")
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (chartId, opts) => {
      try {
        const mcp = new AmplitudeMcpClient();
        const result = await mcp.queryChart(chartId);
        output(extractMcpText(result), opts.format as OutputFormat);
      } catch (err) {
        handleError(err);
      }
    });

  charts
    .command("create")
    .description("Create a chart from a JSON definition (reads from stdin or --definition)")
    .option("--definition <json>", "Chart definition as JSON string")
    .option("--name <name>", "Chart name (required for save)")
    .option("--description <desc>", "Chart description")
    .option("--save", "Save the chart after creation", false)
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (opts) => {
      try {
        let definition: Record<string, unknown>;

        if (opts.definition) {
          definition = JSON.parse(opts.definition);
        } else {
          const chunks: Buffer[] = [];
          for await (const chunk of process.stdin) {
            chunks.push(chunk as Buffer);
          }
          definition = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        }

        const mcp = new AmplitudeMcpClient();

        console.error("Querying dataset...");
        const result = await mcp.queryDataset(definition);
        const resultText = extractMcpText(result);

        if (opts.save && opts.name) {
          const editId = extractEditId(resultText);
          if (editId) {
            console.error(`Saving chart as "${opts.name}"...`);
            const saveResult = await mcp.saveChart(editId, opts.name, opts.description);
            output(extractMcpText(saveResult), opts.format as OutputFormat);
          } else {
            console.error("Warning: Could not extract editId. Chart not saved.");
            output(resultText, opts.format as OutputFormat);
          }
        } else {
          output(resultText, opts.format as OutputFormat);
          if (!opts.save) {
            console.error("\nChart previewed but not saved. Use --save --name 'Name' to save.");
          }
        }
      } catch (err) {
        handleError(err);
      }
    });

  charts
    .command("discover <query>")
    .description("Discover events, custom events, and their properties")
    .option("--type <types>", "Entity types (comma-separated)", "EVENT,CUSTOM_EVENT")
    .option("--limit <n>", "Max results", "20")
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (query, opts) => {
      try {
        const mcp = new AmplitudeMcpClient();
        const entityTypes = opts.type.split(",").map((t: string) => t.trim());
        const result = await mcp.search(query, entityTypes, parseInt(opts.limit));
        output(extractMcpText(result), opts.format as OutputFormat);
      } catch (err) {
        handleError(err);
      }
    });

  charts
    .command("event-props <event-type>")
    .description("Get all properties for an event type")
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (eventType, opts) => {
      try {
        const mcp = new AmplitudeMcpClient();
        const result = await mcp.getEventProperties(eventType);
        output(extractMcpText(result), opts.format as OutputFormat);
      } catch (err) {
        handleError(err);
      }
    });
}
