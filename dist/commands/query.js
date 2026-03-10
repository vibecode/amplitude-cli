/**
 * Query commands — event segmentation, funnels, retention, revenue, sessions.
 * All queries go through the Amplitude MCP server via query_dataset.
 */
import { AmplitudeMcpClient } from "../mcp-client.js";
import { output } from "../utils/format.js";
import { extractMcpText } from "../utils/mcp-helpers.js";
import { handleError } from "../utils/errors.js";
/**
 * Build a query_dataset definition for event segmentation.
 */
function buildSegmentDefinition(opts) {
    const definition = {
        chart_type: "LINE",
        time_range: {
            start: opts.from,
            end: opts.to,
        },
        series: [
            {
                event: opts.event,
                metric: opts.metric || "uniques",
                ...(opts.groupBy ? { group_by: parseGroupBy(opts.groupBy) } : {}),
                ...(opts.filters ? { filters: JSON.parse(opts.filters) } : {}),
            },
        ],
    };
    if (opts.interval) {
        definition.interval = intervalToString(opts.interval);
    }
    return definition;
}
/**
 * Parse group-by string: "user:platform" → { type: "user", name: "platform" }
 */
function parseGroupBy(groupBy) {
    const parts = groupBy.split(":");
    if (parts.length > 1) {
        return [{ type: parts[0], name: parts.slice(1).join(":") }];
    }
    return [{ type: "user", name: parts[0] }];
}
/**
 * Map numeric interval to human-readable string for MCP.
 */
function intervalToString(interval) {
    switch (interval) {
        case "1": return "daily";
        case "7": return "weekly";
        case "30": return "monthly";
        case "-300000": return "realtime";
        default: return "daily";
    }
}
export function registerQueryCommands(program) {
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
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
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
            const definition = {
                chart_type: "FUNNEL",
                time_range: {
                    start: opts.from,
                    end: opts.to,
                },
                series: opts.events.map((e) => ({
                    event: e,
                })),
            };
            if (opts.groupBy) {
                definition.group_by = parseGroupBy(opts.groupBy);
            }
            const result = await mcp.queryDataset(definition);
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
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
            const definition = {
                chart_type: "RETENTION",
                time_range: {
                    start: opts.from,
                    end: opts.to,
                },
                series: [
                    { event: opts.startEvent, role: "start" },
                    { event: opts.returnEvent, role: "return" },
                ],
            };
            const result = await mcp.queryDataset(definition);
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
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
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
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
            const definition = {
                chart_type: "LINE",
                time_range: {
                    start: opts.from,
                    end: opts.to,
                },
                series: [
                    {
                        event: "_any_revenue_event",
                        metric: opts.metric || "total",
                        ...(opts.groupBy ? { group_by: parseGroupBy(opts.groupBy) } : {}),
                    },
                ],
            };
            if (opts.interval) {
                definition.interval = intervalToString(opts.interval);
            }
            const result = await mcp.queryDataset(definition);
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
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
            const definition = {
                chart_type: "LINE",
                time_range: {
                    start: opts.from,
                    end: opts.to,
                },
                series: [
                    {
                        event: "_active",
                        metric: "sessions",
                    },
                ],
            };
            const result = await mcp.queryDataset(definition);
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
            handleError(err);
        }
    });
}
//# sourceMappingURL=query.js.map