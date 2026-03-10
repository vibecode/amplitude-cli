#!/usr/bin/env node

/**
 * amplitude-cli (amp)
 *
 * CLI for querying and managing Amplitude analytics data.
 *
 * Two auth modes:
 *   1. API keys (AMPLITUDE_API_KEY + AMPLITUDE_SECRET_KEY) — read-only queries
 *   2. OAuth login (amp auth login) — full read+write, charts, dashboards, experiments
 *
 * Credentials stored in ~/.amplituderc or injected via environment variables.
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
  .version("0.2.0");

// Core (API key auth — read-only)
registerAuthCommands(program);
registerEventCommands(program);
registerQueryCommands(program);
registerUserCommands(program);
registerCohortCommands(program);

// Extended (OAuth auth — read+write via MCP)
registerChartCommands(program);
registerDashboardCommands(program);
registerExperimentCommands(program);

program.parse();
