/**
 * Output formatting utilities.
 * Supports JSON (default), compact JSON, and CSV.
 */
export function formatOutput(data, format) {
    switch (format) {
        case "json":
            return JSON.stringify(data, null, 2);
        case "compact":
            return JSON.stringify(data);
        case "csv":
            return toCSV(data);
        default:
            return JSON.stringify(data, null, 2);
    }
}
/**
 * Best-effort CSV conversion for tabular data.
 * Handles arrays of objects and Amplitude's series format.
 */
function toCSV(data) {
    if (!data || typeof data !== "object") {
        return String(data);
    }
    // Array of objects → standard CSV
    if (Array.isArray(data)) {
        if (data.length === 0)
            return "";
        if (typeof data[0] !== "object" || data[0] === null) {
            return data.map(String).join("\n");
        }
        const keys = Object.keys(data[0]);
        const header = keys.map(escapeCSV).join(",");
        const rows = data.map((row) => {
            const r = row;
            return keys.map((k) => escapeCSV(String(r[k] ?? ""))).join(",");
        });
        return [header, ...rows].join("\n");
    }
    // Amplitude API wraps data in a `data` key — unwrap it for CSV
    const obj = data;
    if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
        const inner = obj.data;
        if (inner.series && inner.xValues) {
            return seriestoCSV(inner);
        }
        // Unwrap and try again
        return toCSV(inner);
    }
    // Direct series format: { series: [...], xValues: [...] }
    if (obj.series && obj.xValues) {
        return seriestoCSV(obj);
    }
    // Fallback: key-value pairs
    const entries = Object.entries(obj);
    return entries.map(([k, v]) => `${escapeCSV(k)},${escapeCSV(String(v))}`).join("\n");
}
function seriestoCSV(data) {
    const xValues = data.xValues;
    const seriesLabels = data.seriesLabels;
    const series = data.series;
    if (!xValues || !series) {
        return JSON.stringify(data, null, 2);
    }
    const headers = ["date"];
    if (seriesLabels) {
        headers.push(...seriesLabels.map((l) => escapeCSV(String(l))));
    }
    else {
        series.forEach((_, i) => headers.push(`series_${i}`));
    }
    const rows = xValues.map((x, i) => {
        const values = series.map((s) => String(s[i] ?? ""));
        return [escapeCSV(x), ...values.map(escapeCSV)].join(",");
    });
    return [headers.join(","), ...rows].join("\n");
}
function escapeCSV(val) {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
}
/**
 * Print to stdout. Commands use this for consistent output.
 */
export function output(data, format = "json") {
    console.log(formatOutput(data, format));
}
//# sourceMappingURL=format.js.map