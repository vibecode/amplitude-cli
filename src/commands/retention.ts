/**
 * Top-level `amp retention` command — build and query retention charts.
 * Friendlier alternative to `amp query retention`.
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
  parseBrackets,
} from "../utils/filters.js";

export function registerRetentionCommand(program: Command): void {
  program
    .command("retention")
    .description(
      'Query a retention chart.\n\n  Example: amp retention --start-event _new --return-event _active --range "Last 90 Days"'
    )
    .requiredOption("--start-event <type>", "Starting event type (e.g. _new, Sign Up)")
    .requiredOption("--return-event <type>", "Return event type (e.g. _active, Purchase)")
    .option(
      "--method <method>",
      "Retention method: nday (default), rolling, bracket",
      "nday"
    )
    .option(
      "--brackets <ranges>",
      'Bracket ranges for bracket method e.g. "0-1,1-5,5-12,12-21"'
    )
    .option(
      "--interval <n>",
      "Interval: 1=daily (default), 7=weekly, 30=monthly",
      "1"
    )
    .option("--range <range>", 'Date range name e.g. "Last 90 Days"')
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
    .action(async (opts) => {
      try {
        const countGroup = opts.countGroup || "User";
        const interval = parseInt(opts.interval || "1", 10);

        const startEventDef: Record<string, unknown> = {
          event_type: opts.startEvent,
          filters: [] as unknown[],
          group_by: [] as unknown[],
        };
        const retentionEventDef: Record<string, unknown> = {
          event_type: opts.returnEvent,
          filters: [] as unknown[],
          group_by: [] as unknown[],
        };

        // Parse filters — apply to startEvent
        if (opts.filter && opts.filter.length > 0) {
          startEventDef.filters = opts.filter.map((f: string) => parseFilter(f));
        }

        const params: Record<string, unknown> = {
          startEvent: startEventDef,
          retentionEvents: [retentionEventDef],
          retentionMethod: opts.method || "nday",
          countGroup,
          interval,
          groupBy: opts.groupBy && opts.groupBy.length > 0
            ? opts.groupBy.map((g: string) => parseGroupBy(g))
            : [],
          segments: [{ conditions: [] }],
        };

        // Brackets for bracket method
        if (opts.method === "bracket" && opts.brackets) {
          params.retentionBrackets = parseBrackets(opts.brackets);
        }

        // Date range
        if (opts.range) {
          params.range = opts.range;
        } else if (opts.start && opts.end) {
          params.range = "custom";
          params.start = opts.start;
          params.end = opts.end;
        }

        const definition: Record<string, unknown> = {
          type: "retention",
          params,
        };

        if (opts.name) {
          definition.name = opts.name;
        }

        const mcp = new AmplitudeMcpClient();

        console.error(`Querying retention (${opts.startEvent} → ${opts.returnEvent})...`);
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
          const chartName = opts.name || "Untitled Retention";
          console.error(`Saving retention chart as "${chartName}"...`);
          const saveResult = await mcp.saveChart(editId, chartName, opts.description);
          output(extractMcpText(saveResult), opts.format as OutputFormat);
        } else {
          output(resultData, opts.format as OutputFormat);
          console.error("\nRetention queried but not saved. Use --save --name 'Name' to save permanently.");
        }
      } catch (err) {
        handleError(err);
      }
    });
}
