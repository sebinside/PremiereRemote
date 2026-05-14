/**
 * @fileoverview This file contains sample actions that demonstrate how PremiereRemote can be used in production.
 * In fact, these aren't just samples - these are the actual actions I use in my production workflow.
 * Feel free to use these as a starting point for your own actions, or delete the entire folder if you don't need them.
 */

import type { premierepro } from "../../internal/types.js";

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars
const ppro = require("premierepro") as premierepro;
// TODO: Remove unused

/**
 * Returns the name of the active sequence, i.e., the sequence that is currently visible in the timeline panel.
 * @returns The name of the active sequence or null if no sequence is active.
 */
export async function getActiveSequenceName(): Promise<string | null> {
    return "Dummy Sequence Name";
}

/**
 * Just a dummy function to demonstrate how to define an action with parameters. This function doesn't do anything useful, but it shows how you can define parameters for your actions.
 * @param param1 A string parameter. You can replace this with any parameters you need for your action.
 * @param param2 A number parameter. You can replace this with any parameters you need for your action.
 */
export async function functionWithSomeParameters(
    param1: string,
    param2: number,
): Promise<void> {
    console.log("This is a dummy function with parameters:", param1, param2);
}
