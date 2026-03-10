/**
 * Amplitude MCP client.
 * Calls Amplitude's MCP server tools (search, query_dataset, save_chart_edits,
 * create_dashboard, etc.) using OAuth tokens.
 *
 * The MCP server exposes tools via JSON-RPC over HTTP (Streamable HTTP transport).
 */
import { getAccessToken, getMcpBaseUrl, getOAuthConfig } from "./utils/oauth.js";
export class AmplitudeMcpClient {
    region;
    sessionId;
    initialized = false;
    constructor(region) {
        const oauth = getOAuthConfig();
        this.region =
            region ||
                process.env.AMPLITUDE_REGION ||
                oauth?.region ||
                "us";
    }
    /**
     * Initialize MCP session. Must be called before any tool calls.
     * Auto-called by callTool if not yet initialized.
     */
    async ensureSession() {
        if (this.initialized && this.sessionId)
            return;
        const token = await getAccessToken(this.region);
        const baseUrl = getMcpBaseUrl(this.region);
        const body = {
            jsonrpc: "2.0",
            id: Date.now(),
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "amplitude-cli", version: "0.2.0" },
            },
        };
        const res = await fetch(`${baseUrl}/mcp`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json, text/event-stream",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });
        const newSessionId = res.headers.get("mcp-session-id");
        if (newSessionId) {
            this.sessionId = newSessionId;
        }
        if (!res.ok) {
            const text = await res.text();
            throw new McpError(res.status, text, "initialize");
        }
        this.initialized = true;
    }
    /**
     * Call an MCP tool on the Amplitude server.
     */
    async callTool(toolName, args = {}) {
        try {
            return await this._callToolOnce(toolName, args);
        }
        catch (err) {
            // Auto-recover from session errors by re-initializing
            if (err instanceof McpError && err.detail.toLowerCase().includes("session")) {
                this.sessionId = undefined;
                this.initialized = false;
                return await this._callToolOnce(toolName, args);
            }
            throw err;
        }
    }
    async _callToolOnce(toolName, args = {}) {
        await this.ensureSession();
        const token = await getAccessToken(this.region);
        const baseUrl = getMcpBaseUrl(this.region);
        const body = {
            jsonrpc: "2.0",
            id: Date.now(),
            method: "tools/call",
            params: {
                name: toolName,
                arguments: args,
            },
        };
        const headers = {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            Authorization: `Bearer ${token}`,
        };
        // Include session ID for continuity if we have one
        if (this.sessionId) {
            headers["Mcp-Session-Id"] = this.sessionId;
        }
        const res = await fetch(`${baseUrl}/mcp`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });
        // Capture session ID from response
        const newSessionId = res.headers.get("mcp-session-id");
        if (newSessionId) {
            this.sessionId = newSessionId;
        }
        if (!res.ok) {
            const text = await res.text();
            throw new McpError(res.status, text, toolName);
        }
        const contentType = res.headers.get("content-type") || "";
        // Handle SSE (text/event-stream) response
        if (contentType.includes("text/event-stream")) {
            return this.parseSSEResponse(res);
        }
        // Handle direct JSON response
        const result = (await res.json());
        if (result.error) {
            throw new McpError(result.error.code, result.error.message, toolName);
        }
        return result.result || { content: [] };
    }
    /**
     * Parse SSE response from MCP server.
     */
    async parseSSEResponse(res) {
        const text = await res.text();
        const lines = text.split("\n");
        let lastData = "";
        for (const line of lines) {
            if (line.startsWith("data: ")) {
                lastData = line.slice(6);
            }
        }
        if (!lastData) {
            return { content: [] };
        }
        try {
            const parsed = JSON.parse(lastData);
            if (parsed.error) {
                throw new McpError(parsed.error.code, parsed.error.message, "sse");
            }
            return parsed.result || { content: [] };
        }
        catch (err) {
            if (err instanceof McpError)
                throw err;
            // Return raw text as content
            return {
                content: [{ type: "text", text: lastData }],
            };
        }
    }
    /**
     * List available MCP tools.
     */
    async listTools() {
        await this.ensureSession();
        const token = await getAccessToken(this.region);
        const baseUrl = getMcpBaseUrl(this.region);
        const headers = {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            Authorization: `Bearer ${token}`,
        };
        if (this.sessionId) {
            headers["Mcp-Session-Id"] = this.sessionId;
        }
        const res = await fetch(`${baseUrl}/mcp`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: Date.now(),
                method: "tools/list",
                params: {},
            }),
        });
        const newSessionId = res.headers.get("mcp-session-id");
        if (newSessionId) {
            this.sessionId = newSessionId;
        }
        if (!res.ok) {
            const text = await res.text();
            throw new McpError(res.status, text, "tools/list");
        }
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("text/event-stream")) {
            return this.parseSSEResponse(res);
        }
        return res.json();
    }
    // ─── Convenience methods for common MCP tools ─────────────────────────
    /**
     * Search for entities (charts, dashboards, events, cohorts, etc.)
     */
    async search(query, entityTypes, limit) {
        return this.callTool("search", {
            query,
            ...(entityTypes && { entity_types: entityTypes }),
            ...(limit && { limit }),
        });
    }
    /**
     * Get context (project info, user info).
     */
    async getContext() {
        return this.callTool("get_context");
    }
    /**
     * Get chart definitions by ID.
     */
    async getCharts(chartIds) {
        return this.callTool("get_charts", { chart_ids: chartIds });
    }
    /**
     * Get dashboard by ID.
     */
    async getDashboard(dashboardId) {
        return this.callTool("get_dashboard", { dashboard_id: dashboardId });
    }
    /**
     * Query a dataset (create/preview a chart).
     * Returns data + an editId that can be saved.
     */
    async queryDataset(definition) {
        return this.callTool("query_dataset", definition);
    }
    /**
     * Save a chart from query_dataset results.
     */
    async saveChart(editId, name, description) {
        return this.callTool("save_chart_edits", {
            edit_id: editId,
            name,
            ...(description && { description }),
        });
    }
    /**
     * Create a dashboard with charts and layout.
     */
    async createDashboard(name, rows, description) {
        return this.callTool("create_dashboard", {
            name,
            rows,
            ...(description && { description }),
        });
    }
    /**
     * Get event properties for an event type.
     */
    async getEventProperties(eventType) {
        return this.callTool("get_event_properties", { event_type: eventType });
    }
    /**
     * Query an existing chart's data.
     */
    async queryChart(chartId) {
        return this.callTool("query_chart", { chart_id: chartId });
    }
    /**
     * Get experiment details.
     */
    async getExperiments(experimentIds) {
        return this.callTool("get_experiments", {
            experiment_ids: experimentIds,
        });
    }
    /**
     * Query experiment results.
     */
    async queryExperiment(experimentId) {
        return this.callTool("query_experiment", {
            experiment_id: experimentId,
        });
    }
}
export class McpError extends Error {
    code;
    detail;
    tool;
    constructor(code, detail, tool) {
        super(`MCP error (${code}) calling ${tool}: ${detail}`);
        this.code = code;
        this.detail = detail;
        this.tool = tool;
        this.name = "McpError";
    }
}
//# sourceMappingURL=mcp-client.js.map