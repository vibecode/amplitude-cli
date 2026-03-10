# amplitude-cli (`amp`)

CLI for querying Amplitude analytics data. Designed for AI agents (OpenClaw) and humans alike.

## Why?

Amplitude has an MCP server for AI tools, but MCP isn't great for agents that need composability — piping output, chaining commands, caching results, streaming large datasets. This CLI talks directly to Amplitude's Dashboard REST API and works anywhere.

## Install

```bash
npm install -g amplitude-cli
```

Or use directly with npx:

```bash
npx amplitude-cli events list
```

## Configuration

Set environment variables:

```bash
export AMPLITUDE_API_KEY="your-api-key"
export AMPLITUDE_SECRET_KEY="your-secret-key"
export AMPLITUDE_REGION="us"  # or "eu"
```

Find your API key and secret key in Amplitude under **Organization Settings → Projects → [Your Project]**.

### OpenClaw Integration

If you're using this with OpenClaw, configure credentials in `~/.openclaw/openclaw.json`:

```json
{
  "skills": {
    "entries": {
      "amplitude": {
        "enabled": true,
        "env": {
          "AMPLITUDE_API_KEY": "your-api-key",
          "AMPLITUDE_SECRET_KEY": "your-secret-key",
          "AMPLITUDE_REGION": "us"
        }
      }
    }
  }
}
```

## Usage

```bash
# Verify authentication
amp auth status

# List events
amp events list
amp events list --search "purchase"

# Event segmentation
amp query segment -e "page_view" --from 2026-01-01 --to 2026-03-01
amp query segment -e "purchase" --from 2026-01-01 --to 2026-03-01 -m totals -g "user:platform"

# Funnel analysis
amp query funnel -e signup onboarding purchase --from 2026-01-01 --to 2026-03-01

# Retention
amp query retention --start-event signup --return-event _active --from 2026-01-01 --to 2026-03-01

# Revenue
amp query revenue --from 2026-01-01 --to 2026-03-01 -m arpu

# User lookup
amp users search "user@example.com"
amp users activity 12345678

# Cohorts
amp cohorts list
amp cohorts get abc123

# Output as CSV
amp query segment -e "signup" --from 2026-01-01 --to 2026-03-01 -f csv > signups.csv

# Pipe to jq
amp query segment -e "purchase" --from 2026-01-01 --to 2026-03-01 -f compact | jq '.data.series'
```

## Output Formats

All commands support `-f` / `--format`:

- `json` — pretty-printed (default)
- `compact` — single-line JSON
- `csv` — CSV output

## License

MIT
