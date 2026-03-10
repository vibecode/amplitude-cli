/**
 * Amplitude REST API client.
 * Reads credentials from:
 *   1. Environment variables (AMPLITUDE_API_KEY, AMPLITUDE_SECRET_KEY)
 *   2. ~/.amplituderc JSON file (fallback for interactive terminal use)
 */
export interface AmplitudeConfig {
    apiKey: string;
    secretKey: string;
    baseUrl: string;
}
export declare function getConfig(): AmplitudeConfig;
export declare class AmplitudeClient {
    private config;
    private authHeader;
    constructor(config?: AmplitudeConfig);
    /**
     * Make an authenticated GET request to the Amplitude API.
     */
    get(path: string, params?: Record<string, string>): Promise<unknown>;
    /**
     * Make an authenticated POST request.
     */
    post(path: string, body: Record<string, unknown>): Promise<unknown>;
    get region(): string;
}
export declare class ApiError extends Error {
    status: number;
    body: string;
    path: string;
    constructor(status: number, body: string, path: string);
}
