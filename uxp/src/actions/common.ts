/**
 * @fileoverview This file contains common utility functions that can be used to either build more advanced actions or by AI agents to query the state as part of the MCP server.
 */

import type { premierepro, Sequence } from "../internal/types.js";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ppro = require("premierepro") as premierepro;

export async function getActiveSequence(): Promise<Sequence | null> {
    const project = await ppro.Project.getActiveProject();
    if (!project) return null;

    const sequence = await project.getActiveSequence();
    if (!sequence) return null;

    return sequence;
}

/**
 * Returns the name of the active sequence, i.e., the sequence that is currently visible in the timeline panel.
 * @returns The name of the active sequence or null if no sequence is active.
 */
export async function getActiveSequenceName(): Promise<string | null> {
    const sequence = await getActiveSequence();
    if (!sequence) return null;

    return sequence.name;
}
