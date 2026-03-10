#!/usr/bin/env node

/**
 * amplitude-cli (amp)
 *
 * CLI for querying and managing Amplitude analytics data.
 * All commands go through Amplitude's MCP server (OAuth).
 *
 * Auth: AMPLITUDE_ACCESS_TOKEN env var (Nango) or `amp auth login` (interactive).
 * Designed for AI agents (OpenClaw) and humans alike.
 */

import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerEventCommands } from "./commands/events.js";
import { registerQueryCommands } from "./commands/query.js";
import { registerUserCommands } from "./commands/users.js";
import { registerCohortCommands } from "./commands/cohorts.js";
import { registerChartCommands } from "./commands/charts.js";
import { registerDashboardCommands } from "./commands/dashboards.js";
import { registerExperimentCommands } from "./commands/experiments.js";

const program = new Command();

program
  .name("amp")
  .description(
    "CLI for Amplitude analytics — query data, create charts, build dashboards, analyze experiments"
  )
  .version("0.3.0");

registerAuthCommands(program);
registerEventCommands(program);
registerQueryCommands(program);
registerUserCommands(program);
registerCohortCommands(program);
registerChartCommands(program);
registerDashboardCommands(program);
registerExperimentCommands(program);

program.parse();
