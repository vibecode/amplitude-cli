/**
 * Dashboard commands — search, create, and manage Amplitude dashboards.
 * All via MCP server (OAuth).
 */
import { AmplitudeMcpClient } from "../mcp-client.js";
import { output } from "../utils/format.js";
import { extractMcpText } from "../utils/mcp-helpers.js";
import { handleError } from "../utils/errors.js";
/**
 * Build a rows layout array from a flat list of chart IDs.
 * Lays out charts in rows of `cols` per row (default 2), width 6 each (total 12 columns).
 */
function buildRowsFromChartIds(chartIds, cols = 2) {
    const itemWidth = Math.floor(12 / cols);
    const rows = [];
    for (let i = 0; i < chartIds.length; i += cols) {
        const batch = chartIds.slice(i, i + cols);
        const items = batch.map((chartId) => ({
            type: "chart",
            chartId,
            width: itemWidth,
        }));
        rows.push({ height: 500, items });
    }
    return rows;
}
export function registerDashboardCommands(program) {
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
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
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
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
            handleError(err);
        }
    });
    dashboards
        .command("create")
        .description("Create a dashboard from chart IDs or a JSON definition")
        .requiredOption("--name <name>", "Dashboard name")
        .option("--description <desc>", "Dashboard description")
        .option("--definition <json>", "Dashboard rows/layout as JSON string (or pipe via stdin)")
        .option("--charts <ids...>", "List of saved chart IDs to include in the dashboard")
        .option("--cols <n>", "Charts per row when using --charts (1-4, default 2)", "2")
        .option("-f, --format <format>", "Output format: json, compact, csv", "json")
        .action(async (opts) => {
        try {
            let rows;
            if (opts.charts && opts.charts.length > 0) {
                // Build layout from chart IDs
                const cols = Math.max(1, Math.min(4, parseInt(opts.cols || "2", 10)));
                rows = buildRowsFromChartIds(opts.charts, cols);
            }
            else if (opts.definition) {
                rows = JSON.parse(opts.definition);
            }
            else {
                // Try stdin
                const chunks = [];
                for await (const chunk of process.stdin) {
                    chunks.push(chunk);
                }
                const raw = Buffer.concat(chunks).toString("utf-8").trim();
                if (!raw) {
                    console.error("Error: Provide --charts <ids...>, --definition <json>, or pipe JSON via stdin.");
                    process.exit(1);
                }
                rows = JSON.parse(raw);
            }
            if (!Array.isArray(rows)) {
                console.error("Error: Dashboard definition must be a JSON array of rows.");
                process.exit(1);
            }
            const mcp = new AmplitudeMcpClient();
            console.error(`Creating dashboard "${opts.name}"...`);
            const result = await mcp.createDashboard(opts.name, rows, opts.description);
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
            handleError(err);
        }
    });
}
//# sourceMappingURL=dashboards.js.map