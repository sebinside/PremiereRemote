/**
 * User-facing configuration for PremiereRemote.
 * Edit this file to change settings without touching the core plugin code.
 * Note: This cannot be done using env variables because the UXP plugin cannot read them.
 */

export const HTTP_PORT = 42400;
export const WS_PORT = 42401;
export const EXTERNAL_WS_PORT = 42402;
export const MCP_PORT = 42403;

/** How long to wait for the UXP plugin to respond to a request before timing out. Adjust this number when experiencing timeouts in long-lasting UXP operations, e.g., full video cutting automation. */
export const UXP_REQUEST_TIMEOUT_MS = 60_000;
