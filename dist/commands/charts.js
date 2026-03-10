/**
 * Chart commands — search, create, query, and manage Amplitude charts.
 * Requires OAuth login (amp auth login).
 */
import { AmplitudeMcpClient } from "../mcp-client.js";
import { output } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
export function registerChartCommands(program) {
    const charts = program
        .command("charts")
        .description("Create and manage Amplitude charts (requires OAuth login)");
    // ─── Search for charts ──────────────────────────────────────────────
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
    // ─── Get chart definition ───────────────────────────────────────────
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
    // ─── Query chart data ───────────────────────────────────────────────
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
    // ─── Create a chart from JSON definition ────────────────────────────
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
            let definition;
            if (opts.definition) {
                definition = JSON.parse(opts.definition);
            }
            else {
                // Read from stdin
                const chunks = [];
                for await (const chunk of process.stdin) {
                    chunks.push(chunk);
                }
                definition = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
            }
            const mcp = new AmplitudeMcpClient();
            // Query the dataset (preview)
            console.error("Querying dataset...");
            const result = await mcp.queryDataset(definition);
            const resultText = extractMcpText(result);
            if (opts.save && opts.name) {
                // Extract editId from result
                const editId = extractEditId(resultText);
                if (editId) {
                    console.error(`Saving chart as "${opts.name}"...`);
                    const saveResult = await mcp.saveChart(editId, opts.name, opts.description);
                    output(extractMcpText(saveResult), opts.format);
                }
                else {
                    console.error("Warning: Could not extract editId from result. Chart not saved.");
                    output(resultText, opts.format);
                }
            }
            else {
                output(resultText, opts.format);
                if (!opts.save) {
                    console.error("\nChart previewed but not saved. Use --save --name 'Chart Name' to save.");
                }
            }
        }
        catch (err) {
            handleError(err);
        }
    });
    // ─── Discover events via MCP search ─────────────────────────────────
    charts
        .command("discover <query>")
        .description("Discover events, custom events, and their properties via MCP")
        .option("--type <types>", "Entity types (comma-separated): EVENT, CUSTOM_EVENT, COHORT, DASHBOARD", "EVENT,CUSTOM_EVENT")
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
    // ─── Get event properties via MCP ───────────────────────────────────
    charts
        .command("event-props <event-type>")
        .description("Get all properties for an event type (via MCP)")
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
// ─── Helpers ────────────────────────────────────────────────────────────
/**
 * Extract text content from MCP tool result.
 * If the text is JSON, parse it; otherwise return the raw string.
 */
function extractMcpText(result) {
    const texts = result.content
        .filter((c) => c.type === "text" && c.text)
        .map((c) => c.text);
    if (texts.length === 0)
        return result;
    if (texts.length === 1) {
        try {
            return JSON.parse(texts[0]);
        }
        catch {
            return texts[0];
        }
    }
    return texts;
}
/**
 * Try to extract an editId from MCP query_dataset result.
 */
function extractEditId(data) {
    if (typeof data === "string") {
        const match = data.match(/editId["\s:]+["']?([a-zA-Z0-9_-]+)/);
        return match?.[1] || null;
    }
    if (typeof data === "object" && data !== null) {
        const obj = data;
        if (typeof obj.editId === "string")
            return obj.editId;
        if (typeof obj.edit_id === "string")
            return obj.edit_id;
        // Search recursively in common locations
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (typeof val === "object" && val !== null) {
                const found = extractEditId(val);
                if (found)
                    return found;
            }
        }
    }
    return null;
}
//# sourceMappingURL=charts.js.map