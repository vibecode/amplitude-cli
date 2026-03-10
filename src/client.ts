/**
 * Amplitude REST API client.
 * Reads credentials from:
 *   1. Environment variables (AMPLITUDE_API_KEY, AMPLITUDE_SECRET_KEY)
 *   2. ~/.amplituderc JSON file (fallback for interactive terminal use)
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const REGIONS: Record<string, string> = {
  us: "https://amplitude.com",
  eu: "https://analytics.eu.amplitude.com",
};

export interface AmplitudeConfig {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
}

/**
 * Try to read credentials from ~/.amplituderc
 * Expected format: { "apiKey": "...", "secretKey": "...", "region": "us" }
 */
function readConfigFile(): Partial<{
  apiKey: string;
  secretKey: string;
  region: string;
}> {
  try {
    const configPath = join(homedir(), ".amplituderc");
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function getConfig(): AmplitudeConfig {
  const fileConfig = readConfigFile();
  const apiKey = process.env.AMPLITUDE_API_KEY || fileConfig.apiKey;
  const secretKey = process.env.AMPLITUDE_SECRET_KEY || fileConfig.secretKey;
  const region = (
    process.env.AMPLITUDE_REGION ||
    fileConfig.region ||
    "us"
  ).toLowerCase();

  if (!apiKey || !secretKey) {
    throw new Error(
      "AMPLITUDE_API_KEY and AMPLITUDE_SECRET_KEY not set. " +
        "Set env vars, create ~/.amplituderc, or use OAuth (amp auth login)."
    );
  }

  const baseUrl = REGIONS[region];
  if (!baseUrl) {
    console.error(`Error: Unknown region "${region}". Use "us" or "eu".`);
    process.exit(1);
  }

  return { apiKey, secretKey, baseUrl };
}

export class AmplitudeClient {
  private config: AmplitudeConfig;
  private authHeader: string;

  constructor(config?: AmplitudeConfig) {
    this.config = config || getConfig();
    this.authHeader =
      "Basic " +
      Buffer.from(`${this.config.apiKey}:${this.config.secretKey}`).toString(
        "base64"
      );
  }

  /**
   * Make an authenticated GET request to the Amplitude API.
   */
  async get(
    path: string,
    params?: Record<string, string>
  ): Promise<unknown> {
    const url = new URL(path, this.config.baseUrl);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new ApiError(res.status, body, url.pathname);
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return res.json();
    }
    return res.text();
  }

  /**
   * Make an authenticated POST request.
   */
  async post(
    path: string,
    body: Record<string, unknown>
  ): Promise<unknown> {
    const url = new URL(path, this.config.baseUrl);

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, text, url.pathname);
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return res.json();
    }
    return res.text();
  }

  get region(): string {
    return this.config.baseUrl.includes(".eu.") ? "eu" : "us";
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
    public path: string
  ) {
    super(`Amplitude API error ${status} on ${path}: ${body}`);
    this.name = "ApiError";
  }
}
