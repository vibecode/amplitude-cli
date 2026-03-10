/**
 * Output formatting utilities.
 * Supports JSON (default), compact JSON, and CSV.
 */
export type OutputFormat = "json" | "compact" | "csv";
export declare function formatOutput(data: unknown, format: OutputFormat): string;
/**
 * Print to stdout. Commands use this for consistent output.
 */
export declare function output(data: unknown, format?: OutputFormat): void;
