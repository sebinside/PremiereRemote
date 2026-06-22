/**
 * A simple action with no parameters.
 * @returns A greeting string.
 */
export async function greet(): Promise<string> {
    return "hello";
}

/**
 * An action with multiple typed parameters.
 * @param name The person's name.
 * @param times How many times to repeat.
 */
export async function repeatGreeting(name: string, times: number): Promise<void> {
    console.log(name, times);
}

// Not an action — no JSDoc description, must not appear in registry
export async function notAnAction(): Promise<void> {}
