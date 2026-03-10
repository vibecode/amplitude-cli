/**
 * Auth commands — login (OAuth), status, logout, tools listing.
 * OAuth is the only auth method — via Nango (managed) or interactive login.
 */
import { Command } from "commander";
export declare function registerAuthCommands(program: Command): void;
