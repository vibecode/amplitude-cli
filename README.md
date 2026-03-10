# amplitude-cli (`amp`)

CLI for querying Amplitude analytics data via Amplitude's MCP server. OAuth only — single auth method, no API keys needed. Designed for AI agents (OpenClaw) and humans alike.

## Install

```bash
npm install -g amplitude-cli
```

## Authentication

All commands use OAuth (via Amplitude's MCP server). Two ways to authenticate:

### Option 1: Environment variable (recommended for agents)

Set `AMPLITUDE_ACCESS_TOKEN` — typically injected via Nango/OpenClaw:

```bash
export AMPLITUDE_ACCESS_TOKEN="your-oauth-token"
```

#### OpenClaw integration

In `~/.openclaw/openclaw.json`:

```json
{
  "skills": {
    "entries": {
      "amplitude": {
        "enabled": true,
        "env": {
          "AMPLITUDE_ACCESS_TOKEN": "your-nango-token"
        }
      }
    }
  }
}
```

### Option 2: Interactive login (for humans)

```bash
amp auth login           # opens browser for OAuth
amp auth login --region eu
```

Tokens are saved to `~/.amplituderc` and auto-refreshed.

## Usage

```bash
# Auth
amp auth status                          # check connection
amp auth tools                           # list available MCP tools

# Events
amp events list                          # list all event types
amp events list -s "purchase"            # search events
amp events props "page_view"             # get properties for an event

# Segmentation
amp query segment -e "page_view" --from 2026-01-01 --to 2026-03-01
amp query segment -e "purchase" --from 2026-01-01 --to 2026-03-01 -m totals -g "user:platform"

# Funnels
amp query funnel -e signup onboarding purchase --from 2026-01-01 --to 2026-03-01

# Retention
amp query retention --start-event signup --return-event _active --from 2026-01-01 --to 2026-03-01

# Revenue
amp query revenue --from 2026-01-01 --to 2026-03-01 -m arpu

# Charts
amp charts search "DAU"                  # search charts
amp charts get abc123                    # get chart definition
amp charts query abc123                  # get chart data
amp charts create --definition '{}' --save --name "My Chart"

# Dashboards
amp dashboards search "KPIs"
amp dashboards get abc123
amp dashboards create --name "Weekly KPIs" --definition '[...]'

# Users
amp users search "user@example.com"
amp users activity 12345678

# Cohorts
amp cohorts list
amp cohorts get abc123

# Experiments
amp experiments search "onboarding"
amp experiments get abc123
amp experiments results abc123

# Output formats
amp query segment -e "signup" --from 2026-01-01 --to 2026-03-01 -f csv > signups.csv
amp query segment -e "purchase" --from 2026-01-01 --to 2026-03-01 -f compact | jq '.data'
```

## Output Formats

All commands support `-f` / `--format`:

- `json` — pretty-printed (default)
- `compact` — single-line JSON (for piping)
- `csv` — CSV output

## Architecture

```
amp CLI → Amplitude MCP server (OAuth)
```

Single transport, single auth method. The CLI is a thin layer over Amplitude's MCP server, which handles all analytics queries, chart creation, dashboard management, and more.

## License

MIT
