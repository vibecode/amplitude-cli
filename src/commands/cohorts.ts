/**
 * Cohort commands — list, get, download.
 */

import { Command } from "commander";
import { AmplitudeClient } from "../client.js";
import { output, type OutputFormat } from "../utils/format.js";
import { handleError } from "../utils/errors.js";

export function registerCohortCommands(program: Command): void {
  const cohorts = program
    .command("cohorts")
    .description("Manage and inspect cohorts");

  cohorts
    .command("list")
    .description("List all cohorts in the project")
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (opts) => {
      try {
        const client = new AmplitudeClient();
        const result = await client.get("/api/3/cohorts");
        output(result, opts.format as OutputFormat);
      } catch (err) {
        handleError(err);
      }
    });

  cohorts
    .command("get <cohort-id>")
    .description("Get a specific cohort definition")
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (cohortId, opts) => {
      try {
        const client = new AmplitudeClient();
        const result = await client.get(`/api/3/cohorts/${cohortId}`);
        output(result, opts.format as OutputFormat);
      } catch (err) {
        handleError(err);
      }
    });

  cohorts
    .command("download <cohort-id>")
    .description("Download cohort user list")
    .option(
      "--props <properties>",
      "Comma-separated user properties to include"
    )
    .option("-f, --format <format>", "Output format: json, compact, csv", "json")
    .action(async (cohortId, opts) => {
      try {
        const client = new AmplitudeClient();
        const params: Record<string, string> = {};
        if (opts.props) {
          params.props = opts.props;
        }
        const result = await client.get(
          `/api/5/cohorts/request/${cohortId}`,
          params
        );
        output(result, opts.format as OutputFormat);
      } catch (err) {
        handleError(err);
      }
    });
}
