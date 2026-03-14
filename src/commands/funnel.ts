/**
 * Top-level `amp funnel` command — build and query funnel charts.
 * Friendlier alternative to `amp query funnel`.
 */

import { Command } from "commander";
import { AmplitudeMcpClient } from "../mcp-client.js";
import { output, type OutputFormat } from "../utils/format.js";
import { extractMcpText, extractEditId } from "../utils/mcp-helpers.js";
import { handleError } from "../utils/errors.js";
import {
  parseFilter,
  parseGroupBy,
  buildDateRange,
  parseConversionWindow,
} from "../utils/filters.js";

export function registerFunnelCommand(program: Command): void {
  program
    .command("funnel [steps...]")
    .description(
      'Query a funnel chart. Pass event types as positional args.\n\n  Example: amp funnel "Sign Up" "Add to Cart" "Purchase" --range "Last 30 Days"'
    )
    .option(
      "--conversion-window <duration>",
      'Conversion window e.g. "7d", "24h", "30m"',
      "7d"
    )
    .option(
      "--order <order>",
      "Funnel order: this_order (default), any_order, exact_order",
      "this_order"
    )
    .option("--range <range>", 'Date range name e.g. "Last 30 Days"')
    .option("--start <date>", "Start date (ISO or unix timestamp)")
    .option("--end <date>", "End date (ISO or unix timestamp)")
    .option(
      "--filter <expr>",
      'Repeatable filter. Format: "user:country is US"',
      (v: string, acc: string[]) => { acc.push(v); return acc; },
      [] as string[]
    )
    .option(
      "--group-by <expr>",
      'Repeatable group-by. Format: "user:country"',
      (v: string, acc: string[]) => { acc.push(v); return acc; },
      [] as string[]
    )
    .option("--count-group <group>", "Count group: User (default), Event, or custom", "User")
    .option("--save", "Save the chart permanently after querying")
    .option("--name <name>", "Chart name")
    .option("--description <desc>", "Chart description")
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (steps: string[], opts) => {
      try {
        if (!steps || steps.length < 2) {
          console.error("Error: Funnel requires at least 2 event steps.");
          console.error("  Example: amp funnel \"Sign Up\" \"Purchase\" --range \"Last 30 Days\"");
          process.exit(1);
        }

        const countGroup = opts.countGroup || "User";

        // Build events array for funnel
        const events = steps.map((step: string) => ({
          event_type: step,
          filters: [] as unknown[],
          group_by: [] as unknown[],
        }));

        // Parse filters — apply to first event and segments
        if (opts.filter && opts.filter.length > 0) {
          const filters = opts.filter.map((f: string) => parseFilter(f));
          events[0].filters = filters;
        }

        // Parse conversion window
        const conversionWindow = parseConversionWindow(opts.conversionWindow || "7d");

        const params: Record<string, unknown> = {
          events,
          countGroup,
          groupBy: opts.groupBy && opts.groupBy.length > 0
            ? opts.groupBy.map((g: string) => parseGroupBy(g))
            : [],
          segments: [{ conditions: [] }],
          order: opts.order || "this_order",
          conversionWindow: conversionWindow,
        };

        // Date range
        if (opts.range) {
          params.range = opts.range;
        } else if (opts.start && opts.end) {
          params.range = "custom";
          params.start = opts.start;
          params.end = opts.end;
        }

        const definition: Record<string, unknown> = {
          type: "funnels",
          params,
        };

        if (opts.name) {
          definition.name = opts.name;
        }

        const mcp = new AmplitudeMcpClient();

        console.error(`Querying funnel (${steps.length} steps)...`);
        const result = await mcp.queryDataset(definition);
        const resultData = extractMcpText(result);

        const shouldSave = opts.save || opts.name;

        if (shouldSave) {
          const editId = extractEditId(resultData);
          if (!editId) {
            console.error("Error: No editId returned from query_dataset. Cannot save chart.");
            console.error("Query result:");
            output(resultData, opts.format as OutputFormat);
            process.exit(1);
          }
          const chartName = opts.name || "Untitled Funnel";
          console.error(`Saving funnel as "${chartName}"...`);
          const saveResult = await mcp.saveChart(editId, chartName, opts.description);
          output(extractMcpText(saveResult), opts.format as OutputFormat);
        } else {
          output(resultData, opts.format as OutputFormat);
          console.error("\nFunnel queried but not saved. Use --save --name 'Name' to save permanently.");
        }
      } catch (err) {
        handleError(err);
      }
    });
}
