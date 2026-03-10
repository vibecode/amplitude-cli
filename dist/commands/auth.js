/**
 * Auth commands — login (OAuth), status, logout, tools listing.
 * OAuth is the only auth method — via Nango (managed) or interactive login.
 */
import { AmplitudeMcpClient } from "../mcp-client.js";
import { login, logout, getOAuthConfig } from "../utils/oauth.js";
import { output } from "../utils/format.js";
import { extractMcpText } from "../utils/mcp-helpers.js";
import { handleError } from "../utils/errors.js";
export function registerAuthCommands(program) {
    const auth = program.command("auth").description("Authentication utilities");
    // ─── OAuth login (interactive) ──────────────────────────────────────
    auth
        .command("login")
        .description("Log in to Amplitude via OAuth (opens browser)")
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
    // ─── Logout ─────────────────────────────────────────────────────────
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
    // ─── Status ─────────────────────────────────────────────────────────
    auth
        .command("status")
        .description("Show authentication status")
        .option("-f, --format <format>", "Output format: json, compact, csv", "json")
        .action(async (opts) => {
        const status = {
            authenticated: false,
            source: null,
            region: null,
        };
        // Check env var (managed environment — Nango)
        if (process.env.AMPLITUDE_ACCESS_TOKEN || process.env.AMPLITUDE_OAUTH_TOKEN) {
            console.error("✓ OAuth: token injected via environment (Nango/managed)");
            status.authenticated = true;
            status.source = "env";
            // Try to get context to verify
            try {
                const mcp = new AmplitudeMcpClient();
                const ctx = await mcp.getContext();
                const text = ctx.content?.[0]?.text;
                if (text) {
                    console.error(`  Context: ${text.slice(0, 150)}`);
                    status.context = extractMcpText(ctx);
                }
            }
            catch (err) {
                console.error("  ⚠ Token present but MCP connection failed");
                status.verified = false;
            }
        }
        else {
            // Check config file (interactive login)
            const oauth = getOAuthConfig();
            if (oauth?.tokens?.access_token) {
                const expired = oauth.tokens.expires_at && Date.now() > oauth.tokens.expires_at;
                const hasRefresh = !!oauth.tokens.refresh_token;
                if (expired && !hasRefresh) {
                    console.error("✗ OAuth: token expired (run 'amp auth login')");
                    status.authenticated = false;
                    status.expired = true;
                }
                else {
                    console.error(`✓ OAuth: logged in (region: ${oauth.region})${expired ? " (will auto-refresh)" : ""}`);
                    console.error(`  Scopes: ${oauth.tokens.scope || "unknown"}`);
                    status.authenticated = true;
                    status.source = "config";
                    status.region = oauth.region;
                    status.scopes = oauth.tokens.scope;
                }
            }
            else {
                console.error("✗ Not authenticated");
                console.error("  Set AMPLITUDE_ACCESS_TOKEN env var, or run 'amp auth login'");
            }
        }
        output(status, opts.format);
    });
    // ─── MCP tools listing ──────────────────────────────────────────────
    auth
        .command("tools")
        .description("List available MCP tools")
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