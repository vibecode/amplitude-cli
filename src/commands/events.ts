/**
 * Event discovery commands — list events, get properties.
 */

import { Command } from "commander";
import { AmplitudeClient } from "../client.js";
import { output, type OutputFormat } from "../utils/format.js";
import { handleError } from "../utils/errors.js";

interface EventType {
  autohidden: boolean;
  clusters: Record<string, unknown>;
  deleted: boolean;
  display: string;
  flow_hidden: boolean;
  hidden: boolean;
  id: number;
  in_waitroom: boolean;
  name: string;
  non_active: boolean;
  timeline_hidden: boolean;
  totals: number;
  totals_delta: number;
  value: string;
}

export function registerEventCommands(program: Command): void {
  const events = program
    .command("events")
    .description("Discover and inspect event types");

  events
    .command("list")
    .description("List all event types in the project")
    .option("-s, --search <query>", "Filter events by name (case-insensitive)")
    .option("--include-hidden", "Include hidden/deleted events", false)
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (opts) => {
      try {
        const client = new AmplitudeClient();
        const result = (await client.get("/api/2/events/list")) as {
          data: EventType[];
        };

        let events = result.data || [];

        // Filter hidden/deleted unless requested
        if (!opts.includeHidden) {
          events = events.filter((e) => !e.hidden && !e.deleted);
        }

        // Search filter
        if (opts.search) {
          const q = opts.search.toLowerCase();
          events = events.filter(
            (e) =>
              e.name?.toLowerCase().includes(q) ||
              e.display?.toLowerCase().includes(q) ||
              e.value?.toLowerCase().includes(q)
          );
        }

        // Output a cleaner representation
        const clean = events.map((e) => ({
          name: e.name || e.value,
          display: e.display,
          totals: e.totals,
          totalsDelta: e.totals_delta,
          nonActive: e.non_active,
        }));

        console.error(`Found ${clean.length} event(s)`);
        output(clean, opts.format as OutputFormat);
      } catch (err) {
        handleError(err);
      }
    });

  events
    .command("property-values <event-type> <property>")
    .description(
      "Get top values for a specific event property (requires start/end dates)"
    )
    .requiredOption("--from <date>", "Start date (YYYY-MM-DD or YYYYMMDD)")
    .requiredOption("--to <date>", "End date (YYYY-MM-DD or YYYYMMDD)")
    .option("--limit <n>", "Max number of values to return", "10")
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (eventType, property, opts) => {
      try {
        const client = new AmplitudeClient();
        const result = await client.get("/api/2/events/properties", {
          e: JSON.stringify({ event_type: eventType }),
          p: property,
          start: opts.from.replace(/-/g, ""),
          end: opts.to.replace(/-/g, ""),
          limit: opts.limit,
        });
        output(result, opts.format as OutputFormat);
      } catch (err) {
        handleError(err);
      }
    });
}
