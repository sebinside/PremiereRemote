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
 * @param loud Whether to capitalize the output.
 */
export async function repeatGreeting(name: string, times: number, loud: boolean): Promise<void> {
    console.log(name, times, loud);
}

// Not an action — no JSDoc description, must not appear in registry
export async function notAnAction(): Promise<void> {}

/** A non-exported action that should not appear in the registry. */
async function nonExportedAction(): Promise<void> {}

/**
 * An action with an optional parameter.
 * @param label An optional label.
 */
export async function optionalParam(label?: string): Promise<void> {}

/**
 * An action with an array parameter.
 * @param items A list of items.
 */
export async function arrayParam(items: string[]): Promise<void> {}

/**
 * An action with an unsupported parameter type.
 * @param opts An options object.
 */
export async function unsupportedParamType(opts: object): Promise<void> {}

/**
 * An action that returns a number.
 * @returns A number value.
 */
export async function returnsNumber(): Promise<number> {
    return 42;
}

/**
 * An action that returns a boolean.
 * @returns A boolean value.
 */
export async function returnsBoolean(): Promise<boolean> {
    return true;
}

/**
 * An action that returns an array.
 * @returns An array of strings.
 */
export async function returnsArray(): Promise<string[]> {
    return [];
}

/**
 * An action that returns an object.
 * @returns An object value.
 */
export async function returnsObject(): Promise<object> {
    return {};
}

/**
 * An action with an undocumented parameter.
 */
export async function undocumentedParam(value: string): Promise<void> {}
