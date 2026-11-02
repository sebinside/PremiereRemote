/**
 * @fileoverview This file serves as a playground for testing and experimenting with the Premiere Pro UXP API.
 * As this file provides full Premiere API IntelliSense and debugging capabilities, it is supriror to Adobe's own playground.
 * It is thus recommended to use this file for testing and experimenting with the API.
 */

import type { premierepro } from "@adobe/premierepro";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ppro = require("premierepro") as premierepro;

/**
 * A simple playground function that can be used to play with the Premiere Pro UXP API.
 */
export async function play(): Promise<void> {
    console.log("Playground function called");

    const project = await ppro.Project.getActiveProject();
    if (!project) return;

    const sequence = await project.getActiveSequence();
    if (!sequence) return;

    console.log(`Active sequence name: ${sequence.name}`);
}
