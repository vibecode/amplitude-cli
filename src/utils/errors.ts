/**
 * Centralized error handling for CLI commands.
 */

import { ApiError } from "../client.js";
import { McpError } from "../mcp-client.js";

export function handleError(err: unknown): never {
  if (err instanceof ApiError) {
    console.error(`\nAmplitude API Error (${err.status}) on ${err.path}`);

    if (err.status === 401) {
      console.error(
        "Authentication failed. Check your AMPLITUDE_API_KEY and AMPLITUDE_SECRET_KEY."
      );
    } else if (err.status === 429) {
      console.error(
        "Rate limited. Amplitude limits concurrent requests (5) and queries per hour.\n" +
          "Try again in a few minutes, or simplify your query."
      );
    } else if (err.status === 400) {
      console.error("Bad request. Check your query parameters.");
    }

    // Try to parse error body for details
    try {
      const body = JSON.parse(err.body);
      if (body.error) {
        const detail =
          typeof body.error === "string"
            ? body.error
            : body.error.message || JSON.stringify(body.error);
        console.error(`Detail: ${detail}`);
        if (body.error.metadata?.details) {
          console.error(
            `  ${typeof body.error.metadata.details === "string" ? body.error.metadata.details : JSON.stringify(body.error.metadata.details)}`
          );
        }
      }
    } catch {
      if (err.body) console.error(`Response: ${err.body.slice(0, 500)}`);
    }

    process.exit(1);
  }

  if (err instanceof McpError) {
    console.error(`\nAmplitude MCP Error (${err.code}) calling ${err.tool}`);

    if (err.code === 401 || err.code === 403) {
      console.error(
        "OAuth token invalid or expired. Run 'amp auth login' to re-authenticate."
      );
    } else if (err.code === -32601) {
      console.error("Unknown MCP tool. Run 'amp auth tools' to list available tools.");
    }

    console.error(`Detail: ${err.detail.slice(0, 500)}`);
    process.exit(1);
  }

  if (err instanceof Error) {
    // Check for common OAuth errors
    if (err.message.includes("Not logged in")) {
      console.error(`\n${err.message}`);
      console.error(
        "This command requires OAuth. Run 'amp auth login' first."
      );
      process.exit(1);
    }

    console.error(`\nError: ${err.message}`);
    process.exit(1);
  }

  console.error("\nUnknown error:", err);
  process.exit(1);
}
