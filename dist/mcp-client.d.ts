/**
 * Amplitude MCP client.
 * Calls Amplitude's MCP server tools (search, query_dataset, save_chart_edits,
 * create_dashboard, etc.) using OAuth tokens.
 *
 * The MCP server exposes tools via JSON-RPC over HTTP (Streamable HTTP transport).
 */
export interface McpToolResult {
    content: Array<{
        type: string;
        text?: string;
        data?: unknown;
    }>;
    isError?: boolean;
}
export declare class AmplitudeMcpClient {
    private region;
    private sessionId?;
    private initialized;
    constructor(region?: string);
    /**
     * Initialize MCP session. Must be called before any tool calls.
     * Auto-called by callTool if not yet initialized.
     */
    private ensureSession;
    /**
     * Call an MCP tool on the Amplitude server.
     */
    callTool(toolName: string, args?: Record<string, unknown>): Promise<McpToolResult>;
    private _callToolOnce;
    /**
     * Parse SSE response from MCP server.
     */
    private parseSSEResponse;
    /**
     * List available MCP tools.
     */
    listTools(): Promise<unknown>;
    /**
     * Search for entities (charts, dashboards, events, cohorts, etc.)
     */
    search(query: string, entityTypes?: string[], limit?: number): Promise<McpToolResult>;
    /**
     * Get context (project info, user info).
     */
    getContext(): Promise<McpToolResult>;
    /**
     * Get chart definitions by ID.
     */
    getCharts(chartIds: string[]): Promise<McpToolResult>;
    /**
     * Get dashboard by ID.
     */
    getDashboard(dashboardId: string): Promise<McpToolResult>;
    /**
     * Query a dataset (create/preview a chart).
     * Returns data + an editId that can be saved.
     */
    queryDataset(definition: Record<string, unknown>): Promise<McpToolResult>;
    /**
     * Save a chart from query_dataset results.
     */
    saveChart(editId: string, name: string, description?: string): Promise<McpToolResult>;
    /**
     * Create a dashboard with charts and layout.
     */
    createDashboard(name: string, rows: unknown[], description?: string): Promise<McpToolResult>;
    /**
     * Get event properties for an event type.
     */
    getEventProperties(eventType: string): Promise<McpToolResult>;
    /**
     * Query an existing chart's data.
     */
    queryChart(chartId: string): Promise<McpToolResult>;
    /**
     * Get experiment details.
     */
    getExperiments(experimentIds: string[]): Promise<McpToolResult>;
    /**
     * Query experiment results.
     */
    queryExperiment(experimentId: string): Promise<McpToolResult>;
}
export declare class McpError extends Error {
    code: number;
    detail: string;
    tool: string;
    constructor(code: number, detail: string, tool: string);
}
