/**
 * User lookup commands — search and activity.
 * Uses MCP get_users tool.
 */
import { AmplitudeMcpClient } from "../mcp-client.js";
import { output } from "../utils/format.js";
import { extractMcpText } from "../utils/mcp-helpers.js";
import { handleError } from "../utils/errors.js";
export function registerUserCommands(program) {
    const users = program
        .command("users")
        .description("User search and activity lookup");
    users
        .command("search <query>")
        .description("Search for users by user ID, device ID, or Amplitude ID")
        .option("-f, --format <format>", "Output format: json, compact, csv", "json")
        .action(async (query, opts) => {
        try {
            const mcp = new AmplitudeMcpClient();
            const result = await mcp.callTool("get_users", {
                user_id: query,
            });
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
            handleError(err);
        }
    });
    users
        .command("activity <amplitude-id>")
        .description("Get event timeline for a specific user")
        .option("--limit <n>", "Max events to return", "100")
        .option("-f, --format <format>", "Output format: json, compact, csv", "json")
        .action(async (amplitudeId, opts) => {
        try {
            const mcp = new AmplitudeMcpClient();
            const result = await mcp.callTool("get_users", {
                amplitude_id: amplitudeId,
                include_events: true,
                event_limit: parseInt(opts.limit),
            });
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
            handleError(err);
        }
    });
}
//# sourceMappingURL=users.js.map