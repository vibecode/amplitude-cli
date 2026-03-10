/**
 * Experiment commands — analyze A/B tests and feature flags.
 * Requires OAuth login (amp auth login).
 */
import { AmplitudeMcpClient } from "../mcp-client.js";
import { output } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
export function registerExperimentCommands(program) {
    const experiments = program
        .command("experiments")
        .description("Analyze experiments and feature flags (requires OAuth login)");
    // ─── Search for experiments ─────────────────────────────────────────
    experiments
        .command("search <query>")
        .description("Search for experiments and feature flags")
        .option("--limit <n>", "Max results", "10")
        .option("-f, --format <format>", "Output format: json, compact, csv", "json")
        .action(async (query, opts) => {
        try {
            const mcp = new AmplitudeMcpClient();
            const result = await mcp.search(query, ["EXPERIMENT"], parseInt(opts.limit));
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
            handleError(err);
        }
    });
    // ─── Get experiment details ─────────────────────────────────────────
    experiments
        .command("get <experiment-id...>")
        .description("Get detailed experiment information")
        .option("-f, --format <format>", "Output format: json, compact, csv", "json")
        .action(async (experimentIds, opts) => {
        try {
            const mcp = new AmplitudeMcpClient();
            const result = await mcp.getExperiments(experimentIds);
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
            handleError(err);
        }
    });
    // ─── Query experiment results ───────────────────────────────────────
    experiments
        .command("results <experiment-id>")
        .description("Get experiment results with statistical significance")
        .option("-f, --format <format>", "Output format: json, compact, csv", "json")
        .action(async (experimentId, opts) => {
        try {
            const mcp = new AmplitudeMcpClient();
            const result = await mcp.queryExperiment(experimentId);
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
            handleError(err);
        }
    });
}
function extractMcpText(result) {
    const texts = result.content
        .filter((c) => c.type === "text" && c.text)
        .map((c) => c.text);
    if (texts.length === 0)
        return result;
    if (texts.length === 1) {
        try {
            return JSON.parse(texts[0]);
        }
        catch {
            return texts[0];
        }
    }
    return texts;
}
//# sourceMappingURL=experiments.js.map