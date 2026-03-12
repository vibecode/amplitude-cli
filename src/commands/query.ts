/**
 * Query commands — event segmentation, funnels, retention, revenue, sessions.
 * All queries go through the Amplitude MCP server via query_dataset.
 *
 * Payload format matches the MCP server's query_dataset tool schema:
 *   { projectId, definition: { type, params: { ... } } }
 */

import { Command } from "commander";
import { AmplitudeMcpClient } from "../mcp-client.js";
import { output, type OutputFormat } from "../utils/format.js";
import { extractMcpText } from "../utils/mcp-helpers.js";
import { handleError } from "../utils/errors.js";

function buildSegmentDefinition(opts: {
  event: string;
  from: string;
  to: string;
  metric?: string;
  interval?: string;
  groupBy?: string;
  filters?: string;
}): Record<string, unknown> {
  const eventDef: Record<string, unknown> = {
    event_type: opts.event,
    filters: opts.filters ? JSON.parse(opts.filters) : [],
    group_by: opts.groupBy ? parseGroupBy(opts.groupBy) : [],
  };

  return {
    type: "eventsSegmentation",
    params: {
      range: "custom",
      start: opts.from,
      end: opts.to,
      events: [eventDef],
      metric: opts.metric || "uniques",
      interval: parseInterval(opts.interval),
      countGroup: "User",
      groupBy: opts.groupBy ? parseGroupBy(opts.groupBy) : [],
      segments: [{ conditions: [] }],
    },
  };
}

function buildFunnelDefinition(opts: {
  events: string[];
  from: string;
  to: string;
  groupBy?: string;
}): Record<string, unknown> {
  return {
    type: "funnel",
    params: {
      range: "custom",
      start: opts.from,
      end: opts.to,
      events: opts.events.map((e: string) => ({
        event_type: e,
        filters: [],
        group_by: [],
      })),
      countGroup: "User",
      groupBy: opts.groupBy ? parseGroupBy(opts.groupBy) : [],
      segments: [{ conditions: [] }],
    },
  };
}

function buildRetentionDefinition(opts: {
  startEvent: string;
  returnEvent: string;
  from: string;
  to: string;
}): Record<string, unknown> {
  return {
    type: "retention",
    params: {
      range: "custom",
      start: opts.from,
      end: opts.to,
      startEvent: { event_type: opts.startEvent, filters: [] },
      returnEvent: { event_type: opts.returnEvent, filters: [] },
      countGroup: "User",
      segments: [{ conditions: [] }],
    },
  };
}

/**
 * Parse group-by string: "user:platform" → [{ type: "user", name: "platform" }]
 */
function parseGroupBy(groupBy: string): Record<string, string>[] {
  const parts = groupBy.split(":");
  if (parts.length > 1) {
    return [{ type: parts[0], name: parts.slice(1).join(":") }];
  }
  return [{ type: "user", name: parts[0] }];
}

/**
 * Parse interval flag to numeric value for MCP.
 */
function parseInterval(interval?: string): number {
  if (!interval) return 1;
  const n = parseInt(interval, 10);
  return isNaN(n) ? 1 : n;
}

export function registerQueryCommands(program: Command): void {
  const query = program
    .command("query")
    .description("Run analytics queries");

  // --- Event Segmentation ---
  query
    .command("segment")
    .description("Event segmentation — count events/users over time")
    .requiredOption("-e, --event <type>", "Event type (_active, _all, or custom)")
    .requiredOption("--from <date>", "Start date (YYYY-MM-DD)")
    .requiredOption("--to <date>", "End date (YYYY-MM-DD)")
    .option("-m, --metric <metric>", "Metric: uniques, totals, avg, pctdau", "uniques")
    .option("-i, --interval <n>", "Interval: 1 (daily), 7 (weekly), 30 (monthly)", "1")
    .option("-g, --group-by <property>", "Group by (format: user:prop or event:prop)")
    .option("--filters <json>", "Event filters as JSON array")
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (opts) => {
      try {
        const mcp = new AmplitudeMcpClient();
        const definition = buildSegmentDefinition(opts);
        const result = await mcp.queryDataset(definition);
        output(extractMcpText(result), opts.format as OutputFormat);
      } catch (err) {
        handleError(err);
      }
    });

  // --- Funnel Analysis ---
  query
    .command("funnel")
    .description("Funnel analysis — conversion through event sequence")
    .requiredOption("-e, --events <types...>", "Events in funnel order (space-separated)")
    .requiredOption("--from <date>", "Start date (YYYY-MM-DD)")
    .requiredOption("--to <date>", "End date (YYYY-MM-DD)")
    .option("-g, --group-by <property>", "Group by property")
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (opts) => {
      try {
        const mcp = new AmplitudeMcpClient();
        const definition = buildFunnelDefinition(opts);
        const result = await mcp.queryDataset(definition);
        output(extractMcpText(result), opts.format as OutputFormat);
      } catch (err) {
        handleError(err);
      }
    });

  // --- Retention Analysis ---
  query
    .command("retention")
    .description("Retention analysis — how users return over time")
    .requiredOption("--start-event <type>", "Starting event (e.g. signup, _new)")
    .requiredOption("--return-event <type>", "Return event (e.g. _active, purchase)")
    .requiredOption("--from <date>", "Start date (YYYY-MM-DD)")
    .requiredOption("--to <date>", "End date (YYYY-MM-DD)")
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (opts) => {
      try {
        const mcp = new AmplitudeMcpClient();
        const definition = buildRetentionDefinition(opts);
        const result = await mcp.queryDataset(definition);
        output(extractMcpText(result), opts.format as OutputFormat);
      } catch (err) {
        handleError(err);
      }
    });

  // --- Chart Data ---
  query
    .command("chart <chart-id>")
    .description("Get data from a saved Amplitude chart by ID")
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

  // --- Revenue ---
  query
    .command("revenue")
    .description("Revenue analysis (LTV, ARPU, etc.)")
    .requiredOption("--from <date>", "Start date (YYYY-MM-DD)")
    .requiredOption("--to <date>", "End date (YYYY-MM-DD)")
    .option("-m, --metric <type>", "Metric: total, paying, arppu, arpu, avg-revenue, ltv", "total")
    .option("-i, --interval <n>", "Interval: 1 (daily), 7 (weekly), 30 (monthly)", "1")
    .option("-g, --group-by <property>", "Group by property")
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (opts) => {
      try {
        const mcp = new AmplitudeMcpClient();
        const definition = buildSegmentDefinition({
          event: "_any_revenue_event",
          from: opts.from,
          to: opts.to,
          metric: opts.metric || "total",
          interval: opts.interval,
          groupBy: opts.groupBy,
        });
        const result = await mcp.queryDataset(definition);
        output(extractMcpText(result), opts.format as OutputFormat);
      } catch (err) {
        handleError(err);
      }
    });

  // --- Sessions ---
  query
    .command("sessions")
    .description("Session analytics")
    .requiredOption("--from <date>", "Start date (YYYY-MM-DD)")
    .requiredOption("--to <date>", "End date (YYYY-MM-DD)")
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (opts) => {
      try {
        const mcp = new AmplitudeMcpClient();
        const definition = buildSegmentDefinition({
          event: "_active",
          from: opts.from,
          to: opts.to,
          metric: "sessions",
        });
        const result = await mcp.queryDataset(definition);
        output(extractMcpText(result), opts.format as OutputFormat);
      } catch (err) {
        handleError(err);
      }
    });
}
