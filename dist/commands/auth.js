/**
 * Auth commands — login (OAuth), setup (API keys), status, logout.
 */
import { writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline";
import { AmplitudeClient } from "../client.js";
import { AmplitudeMcpClient } from "../mcp-client.js";
import { login, logout, getOAuthConfig } from "../utils/oauth.js";
import { output } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
function prompt(question) {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}
export function registerAuthCommands(program) {
    const auth = program.command("auth").description("Authentication utilities");
    // ─── OAuth login (full read+write access via MCP) ───────────────────
    auth
        .command("login")
        .description("Log in to Amplitude via OAuth (enables chart/dashboard creation)")
        .option("--region <region>", "Region: us or eu", "us")
        .action(async (opts) => {
        try {
            const oauthConfig = await login(opts.region);
            console.error(`\nRegion: ${oauthConfig.region}`);
            console.error(`Scopes: ${oauthConfig.tokens.scope || "mcp:read mcp:write offline_access"}`);
            // Verify by getting context
            try {
                const mcp = new AmplitudeMcpClient(oauthConfig.region);
                const ctx = await mcp.getContext();
                const text = ctx.content?.[0]?.text;
                if (text) {
                    console.error(`\nProject context:\n${text.slice(0, 200)}`);
                }
            }
            catch {
                console.error("\n(Could not verify MCP connection — tokens saved anyway)");
            }
        }
        catch (err) {
            if (err instanceof Error) {
                console.error(`\nLogin failed: ${err.message}`);
                process.exit(1);
            }
            throw err;
        }
    });
    // ─── Logout (revoke + clear OAuth tokens) ───────────────────────────
    auth
        .command("logout")
        .description("Revoke OAuth tokens and log out")
        .action(async () => {
        try {
            await logout();
        }
        catch (err) {
            if (err instanceof Error) {
                console.error(`Logout error: ${err.message}`);
                process.exit(1);
            }
            throw err;
        }
    });
    // ─── API key setup (read-only, simpler) ─────────────────────────────
    auth
        .command("setup")
        .description("Save Amplitude API key + secret to ~/.amplituderc (read-only access)")
        .option("--api-key <key>", "API key (skips prompt)")
        .option("--secret-key <key>", "Secret key (skips prompt)")
        .option("--region <region>", "Region: us or eu", "us")
        .action(async (opts) => {
        try {
            const apiKey = opts.apiKey || (await prompt("Amplitude API Key: "));
            const secretKey = opts.secretKey || (await prompt("Amplitude Secret Key: "));
            if (!apiKey || !secretKey) {
                console.error("Error: Both API key and secret key are required.");
                process.exit(1);
            }
            const configPath = join(homedir(), ".amplituderc");
            // Preserve existing OAuth config if present
            let existing = {};
            try {
                existing = JSON.parse(require("node:fs").readFileSync(configPath, "utf-8"));
            }
            catch {
                // No existing config
            }
            const config = {
                ...existing,
                apiKey,
                secretKey,
                region: opts.region,
            };
            writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
            chmodSync(configPath, 0o600);
            console.error(`✓ Credentials saved to ${configPath}`);
            console.error("  Run 'amp auth status' to verify.");
        }
        catch (err) {
            if (err instanceof Error) {
                console.error(`Error: ${err.message}`);
                process.exit(1);
            }
            throw err;
        }
    });
    // ─── Status (show what auth methods are configured) ─────────────────
    auth
        .command("status")
        .description("Show authentication status (API keys + OAuth)")
        .option("-f, --format <format>", "Output format: json, compact, csv", "json")
        .action(async (opts) => {
        const status = {
            apiKeys: false,
            oauth: false,
        };
        // Check API key auth
        try {
            const client = new AmplitudeClient();
            const events = await client.get("/api/2/events/list");
            const eventList = events;
            console.error(`✓ API keys: authenticated (region: ${client.region})`);
            console.error(`  ${eventList.data?.length ?? 0} event types in project`);
            status.apiKeys = true;
            status.apiKeysRegion = client.region;
            status.eventCount = eventList.data?.length ?? 0;
        }
        catch {
            console.error("✗ API keys: not configured or invalid");
        }
        // Check OAuth — env var takes priority (managed environment)
        if (process.env.AMPLITUDE_ACCESS_TOKEN || process.env.AMPLITUDE_OAUTH_TOKEN) {
            console.error("✓ OAuth: token injected via environment (managed)");
            console.error("  Can create charts/dashboards: yes");
            status.oauth = true;
            status.oauthSource = "env";
            status.canWrite = true;
        }
        else {
            const oauth = getOAuthConfig();
            if (oauth?.tokens?.access_token) {
                const expired = oauth.tokens.expires_at && Date.now() > oauth.tokens.expires_at;
                const hasRefresh = !!oauth.tokens.refresh_token;
                if (expired && !hasRefresh) {
                    console.error("✗ OAuth: token expired (no refresh token — run 'amp auth login')");
                    status.oauth = false;
                    status.oauthExpired = true;
                }
                else {
                    console.error(`✓ OAuth: logged in (region: ${oauth.region})${expired ? " (token expired, will auto-refresh)" : ""}`);
                    console.error(`  Scopes: ${oauth.tokens.scope || "unknown"}`);
                    console.error("  Can create charts/dashboards: yes");
                    status.oauth = true;
                    status.oauthSource = "config";
                    status.oauthRegion = oauth.region;
                    status.oauthScopes = oauth.tokens.scope;
                    status.canWrite = true;
                }
            }
            else {
                console.error("✗ OAuth: not logged in (run 'amp auth login' for write access)");
            }
        }
        output(status, opts.format);
    });
    // ─── MCP tools listing (for debugging/discovery) ────────────────────
    auth
        .command("tools")
        .description("List available MCP tools (requires OAuth login)")
        .option("-f, --format <format>", "Output format: json, compact, csv", "json")
        .action(async (opts) => {
        try {
            const mcp = new AmplitudeMcpClient();
            const result = await mcp.listTools();
            output(result, opts.format);
        }
        catch (err) {
            handleError(err);
        }
    });
}
//# sourceMappingURL=auth.js.map