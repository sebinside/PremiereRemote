const board: Record<string,unknown> = {}

/**
 * Retrieves a value from the blackboard.
 * The blackboard is a globally accessible data store that is cleared upon restart.
 * Every class and function is allowed to read, write, and overwrite its data.
 * @param key a string representing the key of the data store to lookup information
 * @returns either the information stored under the key (can be of any type) or undefined iff there is no information available under this key
 */
export function get(key: string): unknown | undefined {
    return board[key];
}

/**
 * Writes a value to the blackboard.
 * The blackboard is a globally accessible data store that is cleared upon restart.
 * Every class and function is allowed to read, write, and overwrite its data.
 * @param key a string representing the key of the data store to write to
 * @param value the information that shall be written or overwritten
 */
export function set(key: string, value: unknown): void {
    board[key] = value;
}