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
export {};
