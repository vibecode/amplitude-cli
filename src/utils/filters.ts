/**
 * Filter and group-by DSL parsers for Amplitude chart/funnel/retention commands.
 *
 * Filter format: "<scope>:<property> <operator> <value>[,value2,...]"
 * Group-by format: "<scope>:<property>"
 */

export interface AmplitudeFilter {
  group_type: string;
  subprop_key: string;
  subprop_op: string;
  subprop_type: string;
  subprop_value: string[];
}

export interface AmplitudeGroupBy {
  type: string;
  value: string;
  group_type: string;
}

const OPERATORS = [
  "is not",
  "does not contain",
  "greater or equal",
  "less or equal",
  "set is not",
  "set is",
  "contains",
  "greater",
  "less",
  "is",
];

/**
 * Parse a filter expression like "user:country is US" or "event:platform is iOS,Android"
 */
export function parseFilter(expr: string): AmplitudeFilter {
  const trimmed = expr.trim();

  // Find the scope prefix: "user:" or "event:"
  const colonIdx = trimmed.indexOf(":");
  if (colonIdx === -1) {
    throw new Error(`Invalid filter expression (missing scope): "${expr}"`);
  }

  const scope = trimmed.slice(0, colonIdx).toLowerCase();
  if (scope !== "user" && scope !== "event") {
    throw new Error(`Invalid filter scope "${scope}" — must be "user" or "event": "${expr}"`);
  }

  const rest = trimmed.slice(colonIdx + 1); // everything after "user:" or "event:"

  // Find operator (try longest first to avoid partial matches)
  let matchedOp: string | null = null;
  let matchedIdx = -1;

  for (const op of OPERATORS) {
    const idx = rest.indexOf(` ${op} `);
    if (idx !== -1) {
      matchedOp = op;
      matchedIdx = idx;
      break;
    }
    // Also handle operator at end (no trailing value, edge case)
    const trailingIdx = rest.lastIndexOf(` ${op}`);
    if (trailingIdx !== -1 && trailingIdx + 1 + op.length === rest.length) {
      matchedOp = op;
      matchedIdx = trailingIdx;
      break;
    }
  }

  if (!matchedOp || matchedIdx === -1) {
    throw new Error(`No valid operator found in filter expression: "${expr}". Supported operators: ${OPERATORS.join(", ")}`);
  }

  const propKey = rest.slice(0, matchedIdx).trim();
  const valueStr = rest.slice(matchedIdx + 1 + matchedOp.length).trim();
  const values = valueStr ? valueStr.split(",").map((v) => v.trim()).filter(Boolean) : [];

  const group_type = scope === "user" ? "User" : "User"; // always "User" for group_type
  const subprop_type = scope === "user" ? "user" : "event";

  return {
    group_type,
    subprop_key: propKey,
    subprop_op: matchedOp,
    subprop_type,
    subprop_value: values,
  };
}

/**
 * Parse a group-by expression like "user:country" or "event:platform"
 */
export function parseGroupBy(expr: string): AmplitudeGroupBy {
  const trimmed = expr.trim();
  const colonIdx = trimmed.indexOf(":");
  if (colonIdx === -1) {
    throw new Error(`Invalid group-by expression (missing scope): "${expr}"`);
  }

  const scope = trimmed.slice(0, colonIdx).toLowerCase();
  if (scope !== "user" && scope !== "event") {
    throw new Error(`Invalid group-by scope "${scope}" — must be "user" or "event": "${expr}"`);
  }

  const propValue = trimmed.slice(colonIdx + 1);

  return {
    type: scope,
    value: propValue,
    group_type: scope === "user" ? "User" : "Event",
  };
}

/**
 * Parse a conversion window like "7d" or "24h" into { value, unit }
 */
export function parseConversionWindow(duration: string): { value: number; unit: string } {
  const match = duration.trim().match(/^(\d+)(d|h|m|w)$/i);
  if (!match) {
    throw new Error(`Invalid conversion window "${duration}". Expected format: "7d", "24h", "30m", "2w"`);
  }
  const value = parseInt(match[1], 10);
  const suffix = match[2].toLowerCase();
  const unitMap: Record<string, string> = {
    h: "hour",
    d: "day",
    w: "week",
    m: "month",
  };
  return { value, unit: unitMap[suffix] };
}

/**
 * Parse bracket ranges like "0-1,1-5,5-12,12-21" into [[0,1],[1,5],[5,12],[12,21]]
 */
export function parseBrackets(ranges: string): number[][] {
  return ranges.split(",").map((range) => {
    const parts = range.trim().split("-");
    if (parts.length !== 2) {
      throw new Error(`Invalid bracket range "${range}". Expected format like "0-1"`);
    }
    return [parseInt(parts[0], 10), parseInt(parts[1], 10)];
  });
}

/**
 * Build date_range object from --range or --start/--end flags
 */
export function buildDateRange(
  range?: string,
  start?: string,
  end?: string
): Record<string, unknown> | undefined {
  if (range) {
    return { type: "range", name: range };
  }
  if (start || end) {
    const obj: Record<string, unknown> = { type: "custom" };
    if (start) obj.start = start;
    if (end) obj.end = end;
    return obj;
  }
  return undefined;
}
