/**
 * Centralized error handling for CLI commands.
 */
import { McpError } from "../mcp-client.js";
export function handleError(err) {
    if (err instanceof McpError) {
        console.error(`\nAmplitude MCP Error (${err.code}) calling ${err.tool}`);
        if (err.code === 401 || err.code === 403) {
            console.error("OAuth token invalid or expired.\n" +
                "If using Nango: check that AMPLITUDE_ACCESS_TOKEN is set.\n" +
                "If interactive: run 'amp auth login' to re-authenticate.");
        }
        else if (err.code === 429) {
            console.error("Rate limited. Try again in a few minutes.");
        }
        else if (err.code === -32601) {
            console.error("Unknown MCP tool. Run 'amp auth tools' to list available tools.");
        }
        console.error(`Detail: ${err.detail.slice(0, 500)}`);
        process.exit(1);
    }
    if (err instanceof Error) {
        if (err.message.includes("Not logged in")) {
            console.error(`\n${err.message}`);
            console.error("Set AMPLITUDE_ACCESS_TOKEN env var, or run 'amp auth login'.");
            process.exit(1);
        }
        console.error(`\nError: ${err.message}`);
        process.exit(1);
    }
    console.error("\nUnknown error:", err);
    process.exit(1);
}
//# sourceMappingURL=errors.js.map