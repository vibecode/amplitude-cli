/**
 * OAuth 2.0 utilities for Amplitude MCP server.
 * Handles:
 *   - Dynamic client registration
 *   - Authorization code flow with PKCE (S256)
 *   - Token storage and refresh
 *   - Local callback server
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const MCP_REGIONS: Record<string, string> = {
  us: "https://mcp.amplitude.com",
  eu: "https://mcp.eu.amplitude.com",
};

const CALLBACK_PORT = 8900;
const CALLBACK_PATH = "/callback";
const SCOPES = "mcp:read mcp:write offline_access";

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  expires_at?: number; // epoch ms — we set this on save
  scope?: string;
}

export interface OAuthConfig {
  client_id: string;
  region: string;
  tokens: OAuthTokens;
}

function configPath(): string {
  return join(homedir(), ".amplituderc");
}

/**
 * Read the full config file (may contain apiKey/secretKey AND/OR oauth).
 */
export function readConfig(): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(configPath(), "utf-8"));
  } catch {
    return {};
  }
}

/**
 * Write config, preserving existing fields.
 */
export function writeConfig(updates: Record<string, unknown>): void {
  const existing = readConfig();
  const merged = { ...existing, ...updates };
  writeFileSync(configPath(), JSON.stringify(merged, null, 2) + "\n", "utf-8");
  chmodSync(configPath(), 0o600);
}

/**
 * Get stored OAuth tokens if they exist.
 */
export function getOAuthConfig(): OAuthConfig | null {
  const config = readConfig();
  if (config.oauth && typeof config.oauth === "object") {
    return config.oauth as OAuthConfig;
  }
  return null;
}

/**
 * Check if an OAuth token is available from any source.
 * Does NOT throw — returns true/false.
 */
export function hasOAuthToken(): boolean {
  if (process.env.AMPLITUDE_ACCESS_TOKEN || process.env.AMPLITUDE_OAUTH_TOKEN) return true;
  const oauth = getOAuthConfig();
  return !!(oauth?.tokens?.access_token);
}

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
export async function getAccessToken(region: string = "us"): Promise<string> {
  // 1. Check env var (managed environment — Masterclaw/Nango injects this)
  const envToken = process.env.AMPLITUDE_ACCESS_TOKEN || process.env.AMPLITUDE_OAUTH_TOKEN;
  if (envToken) {
    return envToken;
  }

  // 2. Check config file (self-serve — `amp auth login`)
  const oauth = getOAuthConfig();
  if (!oauth?.tokens?.access_token) {
    throw new Error(
      "Not logged in. Run 'amp auth login' to authenticate with Amplitude."
    );
  }

  // Check if token is expired (with 60s buffer)
  if (oauth.tokens.expires_at && Date.now() > oauth.tokens.expires_at - 60_000) {
    // Try env refresh token first (managed environment may provide this)
    const envRefresh = process.env.AMPLITUDE_OAUTH_REFRESH_TOKEN;
    const refreshToken = envRefresh || oauth.tokens.refresh_token;

    if (!refreshToken) {
      throw new Error(
        "Access token expired and no refresh token available. Run 'amp auth login' again."
      );
    }
    console.error("Access token expired, refreshing...");
    const newTokens = await refreshTokens(
      oauth.client_id,
      refreshToken,
      region
    );
    // Save refreshed tokens (only to file, not env)
    writeConfig({
      oauth: {
        ...oauth,
        tokens: {
          ...newTokens,
          expires_at: Date.now() + (newTokens.expires_in ?? 3600) * 1000,
        },
      },
    });
    return newTokens.access_token;
  }

  return oauth.tokens.access_token;
}

/**
 * Get MCP base URL for region.
 */
export function getMcpBaseUrl(region: string = "us"): string {
  return MCP_REGIONS[region] || MCP_REGIONS.us;
}

/**
 * Register a dynamic OAuth client with the MCP server.
 */
async function registerClient(
  region: string
): Promise<{ client_id: string }> {
  const baseUrl = getMcpBaseUrl(region);
  const res = await fetch(`${baseUrl}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "amplitude-cli",
      redirect_uris: [`http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: SCOPES,
      token_endpoint_auth_method: "none",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Client registration failed (${res.status}): ${body}`);
  }

  return (await res.json()) as { client_id: string };
}

/**
 * Generate PKCE code_verifier and code_challenge.
 */
function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32)
    .toString("base64url")
    .replace(/[^a-zA-Z0-9\-._~]/g, "")
    .slice(0, 128);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/**
 * Exchange authorization code for tokens.
 */
async function exchangeCode(
  clientId: string,
  code: string,
  codeVerifier: string,
  region: string
): Promise<OAuthTokens> {
  const baseUrl = getMcpBaseUrl(region);
  const res = await fetch(`${baseUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      redirect_uri: `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${body}`);
  }

  return (await res.json()) as OAuthTokens;
}

/**
 * Refresh an expired access token.
 */
async function refreshTokens(
  clientId: string,
  refreshToken: string,
  region: string
): Promise<OAuthTokens> {
  const baseUrl = getMcpBaseUrl(region);
  const res = await fetch(`${baseUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }

  return (await res.json()) as OAuthTokens;
}

/**
 * Start a local HTTP server to catch the OAuth callback.
 */
function waitForCallback(): Promise<{ code: string; state: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || "/", `http://localhost:${CALLBACK_PORT}`);

      if (url.pathname !== CALLBACK_PATH) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        const desc = url.searchParams.get("error_description") || error;
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html><body style="font-family:system-ui;text-align:center;padding:60px">
            <h2>❌ Authentication Failed</h2>
            <p>${desc}</p>
            <p>You can close this tab.</p>
          </body></html>
        `);
        server.close();
        reject(new Error(`OAuth error: ${desc}`));
        return;
      }

      if (!code || !state) {
        res.writeHead(400);
        res.end("Missing code or state");
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html><body style="font-family:system-ui;text-align:center;padding:60px">
          <h2>✅ Authenticated with Amplitude</h2>
          <p>You can close this tab and return to the terminal.</p>
        </body></html>
      `);

      server.close();
      resolve({ code, state });
    });

    server.listen(CALLBACK_PORT, "127.0.0.1", () => {
      // Server ready
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("OAuth callback timed out (5 minutes). Try again."));
    }, 5 * 60 * 1000);
  });
}

/**
 * Run the full OAuth login flow.
 * Returns the stored OAuth config.
 */
export async function login(region: string = "us"): Promise<OAuthConfig> {
  // 1. Register a client (or reuse existing)
  const existing = getOAuthConfig();
  let clientId: string;

  if (existing?.client_id && existing?.region === region) {
    clientId = existing.client_id;
    console.error("Using existing OAuth client registration.");
  } else {
    console.error("Registering OAuth client with Amplitude...");
    const reg = await registerClient(region);
    clientId = reg.client_id;
    console.error(`Registered client: ${clientId}`);
  }

  // 2. Generate PKCE challenge
  const { verifier, challenge } = generatePKCE();
  const state = randomBytes(16).toString("hex");

  // 3. Build authorization URL
  const baseUrl = getMcpBaseUrl(region);
  const authUrl = new URL(`${baseUrl}/authorize`);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  // 4. Start callback server and open browser
  console.error(`\nOpening browser for Amplitude login...\n`);
  console.error(`If the browser doesn't open, visit:\n${authUrl.toString()}\n`);

  const callbackPromise = waitForCallback();

  // Try to open the browser (best-effort)
  try {
    const { exec } = await import("node:child_process");
    const cmd =
      process.platform === "darwin"
        ? `open "${authUrl.toString()}"`
        : process.platform === "win32"
          ? `start "${authUrl.toString()}"`
          : `xdg-open "${authUrl.toString()}" 2>/dev/null || echo "${authUrl.toString()}"`;
    exec(cmd);
  } catch {
    // Browser open failed — user can copy the URL
  }

  // 5. Wait for callback
  const { code, state: returnedState } = await callbackPromise;

  if (returnedState !== state) {
    throw new Error("OAuth state mismatch — possible CSRF attack. Try again.");
  }

  // 6. Exchange code for tokens
  console.error("Exchanging authorization code for tokens...");
  const tokens = await exchangeCode(clientId, code, verifier, region);

  // 7. Save
  const oauthConfig: OAuthConfig = {
    client_id: clientId,
    region,
    tokens: {
      ...tokens,
      expires_at: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    },
  };

  writeConfig({ oauth: oauthConfig });
  console.error("✓ Logged in and tokens saved to ~/.amplituderc");

  return oauthConfig;
}

/**
 * Revoke tokens and clear OAuth config.
 */
export async function logout(): Promise<void> {
  const oauth = getOAuthConfig();
  if (!oauth?.tokens) {
    console.error("Not logged in.");
    return;
  }

  // Best-effort revoke
  try {
    const baseUrl = getMcpBaseUrl(oauth.region);
    await fetch(`${baseUrl}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: oauth.client_id,
        token: oauth.tokens.refresh_token || oauth.tokens.access_token,
      }),
    });
  } catch {
    // Revocation is best-effort
  }

  // Clear OAuth from config (keep apiKey/secretKey if present)
  const config = readConfig();
  delete config.oauth;
  writeFileSync(configPath(), JSON.stringify(config, null, 2) + "\n", "utf-8");
  console.error("✓ Logged out. OAuth tokens removed.");
}
