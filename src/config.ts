/**
 * Server configuration from environment variables.
 *
 * QSYS_POLLING_INTERVAL  — recommended ms between change group polls (default: 350)
 * QSYS_MCP_DEBUG         — set to "true" to enable verbose stderr logging
 * QSYS_PROTECTED_CONTROLS — comma-separated regex patterns; matching controls block writes
 *
 * Example:
 *   QSYS_PROTECTED_CONTROLS="system\..*,.*\.password,emergency.*"
 */

const pollingInterval = parseInt(process.env["QSYS_POLLING_INTERVAL"] ?? "350", 10);
const debug = process.env["QSYS_MCP_DEBUG"] === "true";

const protectedPatterns: RegExp[] = (process.env["QSYS_PROTECTED_CONTROLS"] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((p) => new RegExp(p, "i"));

export const config = { pollingInterval, debug, protectedPatterns };

export function debugLog(...args: unknown[]): void {
  if (debug) console.error("[q-sys-mcp]", ...args);
}

export function isProtected(controlName: string): boolean {
  return protectedPatterns.some((pattern) => pattern.test(controlName));
}
