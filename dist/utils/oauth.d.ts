/**
 * OAuth 2.0 utilities for Amplitude MCP server.
 * Handles:
 *   - Dynamic client registration
 *   - Authorization code flow with PKCE (S256)
 *   - Token storage and refresh
 *   - Local callback server
 */
export interface OAuthTokens {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in?: number;
    expires_at?: number;
    scope?: string;
}
export interface OAuthConfig {
    client_id: string;
    region: string;
    tokens: OAuthTokens;
}
/**
 * Read the full config file (may contain apiKey/secretKey AND/OR oauth).
 */
export declare function readConfig(): Record<string, unknown>;
/**
 * Write config, preserving existing fields.
 */
export declare function writeConfig(updates: Record<string, unknown>): void;
/**
 * Get stored OAuth tokens if they exist.
 */
export declare function getOAuthConfig(): OAuthConfig | null;
/**
 * Check if an OAuth token is available from any source.
 * Does NOT throw — returns true/false.
 */
export declare function hasOAuthToken(): boolean;
/**
 * Get a valid access token. Checks sources in order:
 *   1. AMPLITUDE_ACCESS_TOKEN (or AMPLITUDE_OAUTH_TOKEN) env var (injected by OpenClaw/Masterclaw via Nango)
 *   2. AMPLITUDE_OAUTH_REFRESH_TOKEN env var (for auto-refresh via env)
 *   3. ~/.amplituderc oauth config (from `amp auth login`)
 *
 * Env vars take priority — this is the managed-environment path where
 * Masterclaw handles OAuth via Nango and injects tokens through
 * openclaw.json → skills.entries.amplitude.env.
 */
export declare function getAccessToken(region?: string): Promise<string>;
/**
 * Get MCP base URL for region.
 */
export declare function getMcpBaseUrl(region?: string): string;
/**
 * Run the full OAuth login flow.
 * Returns the stored OAuth config.
 */
export declare function login(region?: string): Promise<OAuthConfig>;
/**
 * Revoke tokens and clear OAuth config.
 */
export declare function logout(): Promise<void>;
