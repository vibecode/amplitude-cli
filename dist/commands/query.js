/**
 * Query commands — event segmentation, funnels, retention, chart data.
 * These are the core analytics queries.
 */
import { AmplitudeClient } from "../client.js";
import { output } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
/**
 * Build the `e` (event) parameter for Amplitude queries.
 * Supports the format: "event_type" or JSON event objects.
 */
function buildEventParam(eventType, groupBy, filters) {
    const event = { event_type: eventType };
    if (groupBy) {
        // group_by can be "user:property" or "event:property"
        const parts = groupBy.split(":");
        const type = parts.length > 1 ? parts[0] : "user";
        const value = parts.length > 1 ? parts[1] : parts[0];
        event.group_by = [{ type, value }];
    }
    if (filters) {
        try {
            event.filters = JSON.parse(filters);
        }
        catch {
            console.error('Warning: Could not parse --filters as JSON. Expected format: [{"subprop_type":"event","subprop_key":"prop","subprop_op":"is","subprop_value":["val"]}]');
        }
    }
    return JSON.stringify(event);
}
/**
 * Format date to YYYYMMDD for Amplitude API.
 */
function formatDate(dateStr) {
    // Accept YYYY-MM-DD or YYYYMMDD
    return dateStr.replace(/-/g, "");
}
export function registerQueryCommands(program) {
    const query = program
        .command("query")
        .description("Run analytics queries");
    // --- Event Segmentation ---
    query
        .command("segment")
        .description("Event segmentation — count events/users over time with filters and group-by")
        .requiredOption("-e, --event <type>", "Event type to query (use _active for any active, _all for any event)")
        .requiredOption("--from <date>", "Start date (YYYY-MM-DD or YYYYMMDD)")
        .requiredOption("--to <date>", "End date (YYYY-MM-DD or YYYYMMDD)")
        .option("-m, --metric <metric>", "Metric: uniques, totals, avg, pctdau, formula", "uniques")
        .option("-i, --interval <n>", "Interval: 1 (daily), 7 (weekly), 30 (monthly), -300000 (realtime)", "1")
        .option("-g, --group-by <property>", "Group by property (format: user:prop or event:prop)")
        .option("--filters <json>", "Event filters as JSON array")
        .option("--segment <json>", "Segment definition as JSON array")
        .option("-f, --format <format>", "Output format: json, compact, csv", "json")
        .action(async (opts) => {
        try {
            const client = new AmplitudeClient();
            const params = {
                e: buildEventParam(opts.event, opts.groupBy, opts.filters),
                start: formatDate(opts.from),
                end: formatDate(opts.to),
                m: opts.metric,
                i: opts.interval,
            };
            if (opts.segment) {
                params.s = opts.segment;
            }
            const result = await client.get("/api/2/events/segmentation", params);
            output(result, opts.format);
        }
        catch (err) {
            handleError(err);
        }
    });
    // --- Funnel Analysis ---
    query
        .command("funnel")
        .description("Funnel analysis — conversion through a sequence of events")
        .requiredOption("-e, --events <types...>", "Event types in funnel order (space-separated)")
        .requiredOption("--from <date>", "Start date (YYYY-MM-DD or YYYYMMDD)")
        .requiredOption("--to <date>", "End date (YYYY-MM-DD or YYYYMMDD)")
        .option("-g, --group-by <property>", "Group by property")
        .option("--segment <json>", "Segment definition as JSON array")
        .option("-f, --format <format>", "Output format: json, compact, csv", "json")
        .action(async (opts) => {
        try {
            const client = new AmplitudeClient();
            const params = {
                start: formatDate(opts.from),
                end: formatDate(opts.to),
            };
            // Funnels take multiple e params
            // Commander doesn't support duplicate params easily, so we build the URL manually
            const url = new URL("/api/2/funnels", "https://placeholder.com");
            url.searchParams.set("start", params.start);
            url.searchParams.set("end", params.end);
            for (const eventType of opts.events) {
                url.searchParams.append("e", JSON.stringify({ event_type: eventType }));
            }
            if (opts.groupBy) {
                url.searchParams.set("g", opts.groupBy);
            }
            if (opts.segment) {
                url.searchParams.set("s", opts.segment);
            }
            // Build the path with query string
            const pathWithQuery = `/api/2/funnels${url.search}`;
            const result = await client.get(pathWithQuery);
            output(result, opts.format);
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
        .requiredOption("--from <date>", "Start date (YYYY-MM-DD or YYYYMMDD)")
        .requiredOption("--to <date>", "End date (YYYY-MM-DD or YYYYMMDD)")
        .option("--retention-type <type>", "Type: bracket, unbounded, n-day (omit for standard retention)")
        .option("--segment <json>", "Segment definition as JSON array")
        .option("-f, --format <format>", "Output format: json, compact, csv", "json")
        .action(async (opts) => {
        try {
            const client = new AmplitudeClient();
            const params = {
                se: JSON.stringify({ event_type: opts.startEvent }),
                re: JSON.stringify({ event_type: opts.returnEvent }),
                start: formatDate(opts.from),
                end: formatDate(opts.to),
            };
            if (opts.retentionType) {
                params.rm = opts.retentionType;
            }
            if (opts.segment) {
                params.s = opts.segment;
            }
            const result = await client.get("/api/2/retention", params);
            output(result, opts.format);
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
            const client = new AmplitudeClient();
            const result = await client.get(`/api/3/chart/${chartId}/query`);
            output(result, opts.format);
        }
        catch (err) {
            handleError(err);
        }
    });
    // --- Active/New User Counts ---
    query
        .command("users")
        .description("Get active or new user counts over time")
        .requiredOption("--from <date>", "Start date (YYYY-MM-DD or YYYYMMDD)")
        .requiredOption("--to <date>", "End date (YYYY-MM-DD or YYYYMMDD)")
        .option("-m, --metric <type>", "Metric: active or new", "active")
        .option("-i, --interval <n>", "Interval: 1 (daily), 7 (weekly), 30 (monthly)", "1")
        .option("-g, --group-by <property>", "Group by property")
        .option("--segment <json>", "Segment definition as JSON array")
        .option("-f, --format <format>", "Output format: json, compact, csv", "json")
        .action(async (opts) => {
        try {
            const client = new AmplitudeClient();
            const params = {
                start: formatDate(opts.from),
                end: formatDate(opts.to),
                m: opts.metric,
                i: opts.interval,
            };
            if (opts.groupBy) {
                params.g = opts.groupBy;
            }
            if (opts.segment) {
                params.s = opts.segment;
            }
            const result = await client.get("/api/2/users", params);
            output(result, opts.format);
        }
        catch (err) {
            handleError(err);
        }
    });
    // --- Revenue ---
    query
        .command("revenue")
        .description("Revenue analysis (LTV, ARPU, etc.)")
        .requiredOption("--from <date>", "Start date (YYYY-MM-DD or YYYYMMDD)")
        .requiredOption("--to <date>", "End date (YYYY-MM-DD or YYYYMMDD)")
        .option("-m, --metric <type>", "Metric: total, paying, arppu, arpu, avg-revenue, ltv", "total")
        .option("-i, --interval <n>", "Interval: 1 (daily), 7 (weekly), 30 (monthly)", "1")
        .option("-g, --group-by <property>", "Group by property")
        .option("--segment <json>", "Segment definition as JSON array")
        .option("-f, --format <format>", "Output format: json, compact, csv", "json")
        .action(async (opts) => {
        try {
            const client = new AmplitudeClient();
            const params = {
                start: formatDate(opts.from),
                end: formatDate(opts.to),
                m: opts.metric,
                i: opts.interval,
            };
            if (opts.groupBy) {
                params.g = opts.groupBy;
            }
            if (opts.segment) {
                params.s = opts.segment;
            }
            const result = await client.get("/api/2/revenue/day", params);
            output(result, opts.format);
        }
        catch (err) {
            handleError(err);
        }
    });
    // --- Sessions ---
    query
        .command("sessions")
        .description("Average sessions per user")
        .requiredOption("--from <date>", "Start date (YYYY-MM-DD or YYYYMMDD)")
        .requiredOption("--to <date>", "End date (YYYY-MM-DD or YYYYMMDD)")
        .option("--segment <json>", "Segment definition as JSON array")
        .option("-f, --format <format>", "Output format: json, compact, csv", "json")
        .action(async (opts) => {
        try {
            const client = new AmplitudeClient();
            const params = {
                start: formatDate(opts.from),
                end: formatDate(opts.to),
            };
            if (opts.segment) {
                params.s = opts.segment;
            }
            const result = await client.get("/api/2/sessions/average", params);
            output(result, opts.format);
        }
        catch (err) {
            handleError(err);
        }
    });
}
//# sourceMappingURL=query.js.map