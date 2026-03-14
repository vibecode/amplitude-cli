/**
 * Chart commands — search, create, query, and manage Amplitude charts.
 * All via MCP server (OAuth).
 */
import { AmplitudeMcpClient } from "../mcp-client.js";
import { output } from "../utils/format.js";
import { extractMcpText, extractEditId } from "../utils/mcp-helpers.js";
import { handleError } from "../utils/errors.js";
import { parseFilter, parseGroupBy, } from "../utils/filters.js";
/**
 * Build an eventsSegmentation definition from simple flags.
 * The MCP query_dataset tool expects:
 *   { definition: { app, type, name, params: { range, events, metric, interval, ... } }, projectId }
 * The `app` field and `projectId` are set by queryDataset() in mcp-client.ts,
 * so we just need to build { type, name?, params }.
 */
function buildChartDefinition(opts) {
    const metric = opts.metric || "uniques";
    const interval = opts.interval !== undefined ? parseInt(opts.interval, 10) : 1;
    const countGroup = opts.countGroup || "User";
    const eventDef = {
        event_type: opts.event,
        filters: [],
        group_by: [],
    };
    // Parse per-event filters
    if (opts.filter && opts.filter.length > 0) {
        eventDef.filters = opts.filter.map((f) => parseFilter(f));
    }
    // Parse per-event group-by
    if (opts.groupBy && opts.groupBy.length > 0) {
        eventDef.group_by = opts.groupBy.map((g) => parseGroupBy(g));
    }
    const params = {
        events: [eventDef],
        metric,
        interval,
        countGroup,
        groupBy: opts.groupBy && opts.groupBy.length > 0
            ? opts.groupBy.map((g) => parseGroupBy(g))
            : [],
        segments: [{ conditions: [] }],
    };
    // Date range — use range string or custom start/end
    if (opts.range) {
        params.range = opts.range;
    }
    else if (opts.start && opts.end) {
        params.range = "custom";
        params.start = opts.start;
        params.end = opts.end;
    }
    else if (opts.start || opts.end) {
        params.range = "custom";
        if (opts.start)
            params.start = opts.start;
        if (opts.end)
            params.end = opts.end;
    }
    const definition = {
        type: "eventsSegmentation",
        params,
    };
    if (opts.name) {
        definition.name = opts.name;
    }
    return definition;
}
export function registerChartCommands(program) {
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
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
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
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
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
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
            handleError(err);
        }
    });
    charts
        .command("create")
        .description("Create a chart from flags or a JSON definition")
        // --- Raw JSON path ---
        .option("--definition <json>", "Chart definition as JSON string (or pipe via stdin)")
        // --- Flag-based path ---
        .option("--event <type>", "Event type (e.g. _active, Purchase)")
        .option("--metric <metric>", "Metric: uniques (default), totals, average, pctdau, sums, value_avg", "uniques")
        .option("--interval <n>", "Interval: 1=daily (default), 7=weekly, 30=monthly, 90=quarterly, -3600000=hourly", "1")
        .option("--range <range>", 'Date range name e.g. "Last 30 Days"')
        .option("--start <date>", "Start date (ISO or unix timestamp)")
        .option("--end <date>", "End date (ISO or unix timestamp)")
        .option("--filter <expr>", 'Repeatable filter. Format: "user:country is US"', (v, acc) => { acc.push(v); return acc; }, [])
        .option("--group-by <expr>", 'Repeatable group-by. Format: "user:country"', (v, acc) => { acc.push(v); return acc; }, [])
        .option("--count-group <group>", "Count group: User (default), Event, or custom", "User")
        // --- Save options ---
        .option("--save", "Save the chart permanently after querying")
        .option("--name <name>", "Chart name")
        .option("--description <desc>", "Chart description")
        .option("-f, --format <format>", "Output format: json, compact, csv", "json")
        .action(async (opts) => {
        try {
            let definition;
            if (opts.event) {
                // Flag-based path
                definition = buildChartDefinition({
                    event: opts.event,
                    metric: opts.metric,
                    interval: opts.interval,
                    range: opts.range,
                    start: opts.start,
                    end: opts.end,
                    filter: opts.filter,
                    groupBy: opts.groupBy,
                    countGroup: opts.countGroup,
                    name: opts.name,
                });
            }
            else if (opts.definition) {
                definition = JSON.parse(opts.definition);
            }
            else {
                // Try stdin
                const chunks = [];
                for await (const chunk of process.stdin) {
                    chunks.push(chunk);
                }
                const raw = Buffer.concat(chunks).toString("utf-8").trim();
                if (!raw) {
                    console.error("Error: Provide --event <type>, --definition <json>, or pipe JSON via stdin.");
                    process.exit(1);
                }
                definition = JSON.parse(raw);
            }
            const mcp = new AmplitudeMcpClient();
            console.error("Querying dataset...");
            const result = await mcp.queryDataset(definition);
            const resultData = extractMcpText(result);
            const shouldSave = opts.save || opts.name;
            if (shouldSave) {
                const editId = extractEditId(resultData);
                if (!editId) {
                    console.error("Error: No editId returned from query_dataset. Cannot save chart.");
                    console.error("Query result:");
                    output(resultData, opts.format);
                    process.exit(1);
                }
                const chartName = opts.name || "Untitled Chart";
                console.error(`Saving chart as "${chartName}"...`);
                const saveResult = await mcp.saveChart(editId, chartName, opts.description);
                output(extractMcpText(saveResult), opts.format);
            }
            else {
                output(resultData, opts.format);
                console.error("\nChart queried but not saved. Use --save --name 'Name' to save permanently.");
            }
        }
        catch (err) {
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
            const entityTypes = opts.type.split(",").map((t) => t.trim());
            const result = await mcp.search(query, entityTypes, parseInt(opts.limit));
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
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
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
            handleError(err);
        }
    });
}
//# sourceMappingURL=charts.js.map