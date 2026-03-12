/**
 * Cohort commands — list, get, create.
 * Uses MCP tools: search, get_cohorts, create_cohort.
 */
import { AmplitudeMcpClient } from "../mcp-client.js";
import { output } from "../utils/format.js";
import { extractMcpText } from "../utils/mcp-helpers.js";
import { handleError } from "../utils/errors.js";
export function registerCohortCommands(program) {
    const cohorts = program
        .command("cohorts")
        .description("Manage and inspect cohorts");
    cohorts
        .command("list")
        .description("List cohorts in the project")
        .option("-s, --search <query>", "Search cohorts by name", "")
        .option("--limit <n>", "Max results", "20")
        .option("-f, --format <format>", "Output format: json, compact, csv", "json")
        .action(async (opts) => {
        try {
            const mcp = new AmplitudeMcpClient();
            const query = opts.search || "*";
            const result = await mcp.search(query, ["COHORT"], parseInt(opts.limit));
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
            handleError(err);
        }
    });
    cohorts
        .command("get <cohort-id...>")
        .description("Get cohort definitions by ID")
        .option("-f, --format <format>", "Output format: json, compact, csv", "json")
        .action(async (cohortIds, opts) => {
        try {
            const mcp = new AmplitudeMcpClient();
            const result = await mcp.callTool("get_cohorts", {
                cohortIds,
            });
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
            handleError(err);
        }
    });
    cohorts
        .command("create")
        .description("Create a cohort from a JSON definition (reads from stdin or --definition)")
        .requiredOption("--name <name>", "Cohort name")
        .option("--description <desc>", "Cohort description")
        .option("--definition <json>", "Cohort definition as JSON string")
        .option("-f, --format <format>", "Output format: json, compact, csv", "json")
        .action(async (opts) => {
        try {
            let definition;
            if (opts.definition) {
                definition = JSON.parse(opts.definition);
            }
            else {
                const chunks = [];
                for await (const chunk of process.stdin) {
                    chunks.push(chunk);
                }
                definition = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
            }
            const mcp = new AmplitudeMcpClient();
            const result = await mcp.callTool("create_cohort", {
                name: opts.name,
                ...(opts.description ? { description: opts.description } : {}),
                ...definition,
            });
            output(extractMcpText(result), opts.format);
        }
        catch (err) {
            handleError(err);
        }
    });
}
//# sourceMappingURL=cohorts.js.map