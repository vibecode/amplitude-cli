#!/usr/bin/env node

/**
 * amplitude-cli (amp)
 *
 * CLI for querying and managing Amplitude analytics data.
 * All commands go through Amplitude's MCP server (OAuth).
 *
 * Auth: AMPLITUDE_ACCESS_TOKEN env var (Nango) or `amp auth login` (interactive).
 * Designed for AI agents and humans alike.
 */

import { Command } from "commander";
import { CLI_VERSION } from "./mcp-client.js";
import { registerAuthCommands } from "./commands/auth.js";
import { registerEventCommands } from "./commands/events.js";
import { registerQueryCommands } from "./commands/query.js";
import { registerUserCommands } from "./commands/users.js";
import { registerCohortCommands } from "./commands/cohorts.js";
import { registerChartCommands } from "./commands/charts.js";
import { registerDashboardCommands } from "./commands/dashboards.js";
import { registerExperimentCommands } from "./commands/experiments.js";
import { registerCallCommand } from "./commands/call.js";
import { registerToolsCommands } from "./commands/tools.js";
import { registerFunnelCommand } from "./commands/funnel.js";
import { registerRetentionCommand } from "./commands/retention.js";

const program = new Command();

program
  .name("amp")
  .description(
    "CLI for Amplitude analytics — query data, create charts, build dashboards, analyze experiments"
  )
  .version(CLI_VERSION)
  .option("--project-id <id>", "Amplitude project ID (or set AMPLITUDE_PROJECT_ID)");

program.hook("preAction", (thisCommand) => {
  const opts = thisCommand.opts();
  if (opts.projectId && !process.env.AMPLITUDE_PROJECT_ID) {
    process.env.AMPLITUDE_PROJECT_ID = opts.projectId;
  }
});

registerAuthCommands(program);
registerEventCommands(program);
registerQueryCommands(program);
registerUserCommands(program);
registerCohortCommands(program);
registerChartCommands(program);
registerDashboardCommands(program);
registerExperimentCommands(program);
registerCallCommand(program);
registerToolsCommands(program);
registerFunnelCommand(program);
registerRetentionCommand(program);

program.parse();
