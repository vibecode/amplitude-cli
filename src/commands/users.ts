/**
 * User lookup commands — search and activity.
 */

import { Command } from "commander";
import { AmplitudeClient } from "../client.js";
import { output, type OutputFormat } from "../utils/format.js";
import { handleError } from "../utils/errors.js";

export function registerUserCommands(program: Command): void {
  const users = program
    .command("users")
    .description("User search and activity lookup");

  users
    .command("search <query>")
    .description(
      "Search for users by Amplitude ID, user ID, or device ID"
    )
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (query, opts) => {
      try {
        const client = new AmplitudeClient();
        const result = await client.get("/api/2/usersearch", {
          user: query,
        });
        output(result, opts.format as OutputFormat);
      } catch (err) {
        handleError(err);
      }
    });

  users
    .command("activity <amplitude-id>")
    .description("Get event timeline for a specific user")
    .option(
      "--offset <n>",
      "Number of events to skip (for pagination)",
      "0"
    )
    .option("--limit <n>", "Max events to return", "1000")
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (amplitudeId, opts) => {
      try {
        const client = new AmplitudeClient();
        const result = await client.get("/api/2/useractivity", {
          user: amplitudeId,
          offset: opts.offset,
          limit: opts.limit,
        });
        output(result, opts.format as OutputFormat);
      } catch (err) {
        handleError(err);
      }
    });
}
