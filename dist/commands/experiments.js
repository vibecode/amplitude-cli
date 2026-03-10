/**
 * Experiment commands — analyze A/B tests and feature flags.
 * All via MCP server (OAuth).
 */
import { AmplitudeMcpClient } from "../mcp-client.js";
import { output } from "../utils/format.js";
import { extractMcpText } from "../utils/mcp-helpers.js";
import { handleError } from "../utils/errors.js";
export function registerExperimentCommands(program) {
    const experiments = program
        .command("experiments")
        .description("Analyze experiments and feature flags");
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
//# sourceMappingURL=experiments.js.map