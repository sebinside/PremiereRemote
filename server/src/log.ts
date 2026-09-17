import type { OutgoingMessage } from "premiereremote-shared";

/** Longest server label currently in use — keeps `[label]` prefixes aligned to the same width. */
const LABEL_WIDTH = "HTTP".length;

/** Formats a server label into a fixed-width `[label] ` prefix, padded after the closing bracket. */
function prefix(server: string): string {
    return `[${server}]`.padEnd(LABEL_WIDTH + 3);
}

/** Uniformly logs a server lifecycle message, e.g. `[UXP] plugin connected`. */
export function log(server: string, message: string): void {
    console.log(`${prefix(server)}${message}`);
}

/** Uniformly logs a server error, e.g. `[UXP] socket error:`. */
export function logError(server: string, message: string, err?: unknown): void {
    console.error(`${prefix(server)}${message}`, err ?? "");
}

/**
 * Uniformly logs incoming API calls across all servers (HTTP, WS, MCP).
 *
 * Example:
 * ```
 *   [HTTP] → common/getAllVideoClips { trackIndex: '2' }
 *   [MCP] → common/getActiveSequenceName (no params)
 * ```
 */
export function logIncomingCall(
    server: string,
    actionId: string,
    params: Record<string, unknown>,
): void {
    console.log(
        `${prefix(server)}→ ${actionId}`,
        Object.keys(params).length ? params : "(no params)",
    );
}

/**
 * Uniformly logs outgoing API results across all servers (HTTP, WS, MCP).
 *
 * Example:
 * ```
 *   [HTTP] ← common/getAllVideoClips {
        id: '68274cdd-70c5-410a-9c5b-9e14bb198f31',
        status: 'OK',
        result: [ { index: 2, name: 'Video 3', items: [Array] } ]
        }
 * ```
 */
export function logOutgoingResult(
    server: string,
    actionId: string,
    result: OutgoingMessage,
): void {
    // Intentionally not stringifying the result, to minimize spamming the console with large JSON blobs.
    console.log(`${prefix(server)}← ${actionId}`, result);
}

/**
 * Returns a listener for a server's `'error'` event (e.g. EADDRINUSE), logging a clear
 * message and exiting instead of letting Node crash with an unhandled-exception stack trace.
 */
export function logAndExit(label: string): (err: Error) => void {
    return (err: Error): void => {
        logError(label, "failed to start:", err.message);
        process.exit(1);
    };
}
