import type { premierepro } from "../types.js";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ppro = require("premierepro") as premierepro;

export async function getActiveSequenceName(): Promise<string | null> {
    const project = await ppro.Project.getActiveProject();
    if (!project) return null;

    const sequence = await project.getActiveSequence();
    if (!sequence) return null;

    return sequence.name;
}
