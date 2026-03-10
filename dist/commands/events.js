/**
 * Event discovery commands — list events, get properties.
 * All queries go through the Amplitude MCP server (OAuth).
 */
import { AmplitudeMcpClient } from "../mcp-client.js";
import { output } from "../utils/format.js";
import { extractMcpText } from "../utils/mcp-helpers.js";
import { handleError } from "../utils/errors.js";
export function registerEventCommands(program) {
    const events = program
        .command("events")
        .description("Discover and inspect event types");
    events
        .command("list")
        .description("List event types in the project")
        .option("-s, --search <query>", "Filter events by name")
        .option("--limit <n>", "Max results", "50")
        .option("-f, --format <format>", "Output format: json, compact, csv", "json")
        .action(async (opts) => {
        try {
            const mcp = new AmplitudeMcpClient();
            const query = opts.search || "*";
            const result = await mcp.search(query, ["EVENT", "CUSTOM_EVENT"], parseInt(opts.limit));
            const data = extractMcpText(result);
            output(data, opts.format);
        }
        catch (err) {
            handleError(err);
        }
    });
    events
        .command("props <event-type>")
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
//# sourceMappingURL=events.js.map