/**
 * Dashboard commands — search, create, and manage Amplitude dashboards.
 * Requires OAuth login (amp auth login).
 */
import { AmplitudeMcpClient } from "../mcp-client.js";
import { output } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
export function registerDashboardCommands(program) {
    const dashboards = program
        .command("dashboards")
        .description("Create and manage Amplitude dashboards (requires OAuth login)");
    // ─── Search for dashboards ──────────────────────────────────────────
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
    // ─── Get dashboard ──────────────────────────────────────────────────
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
    // ─── Create dashboard from JSON ─────────────────────────────────────
    dashboards
        .command("create")
        .description("Create a dashboard from a JSON definition (reads from stdin or --definition)")
        .requiredOption("--name <name>", "Dashboard name")
        .option("--description <desc>", "Dashboard description")
        .option("--definition <json>", "Dashboard rows/layout as JSON string")
        .option("-f, --format <format>", "Output format: json, compact, csv", "json")
        .action(async (opts) => {
        try {
            let rows;
            if (opts.definition) {
                rows = JSON.parse(opts.definition);
            }
            else {
                // Read from stdin
                const chunks = [];
                for await (const chunk of process.stdin) {
                    chunks.push(chunk);
                }
                rows = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
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
/**
 * Extract text content from MCP tool result.
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
//# sourceMappingURL=dashboards.js.map