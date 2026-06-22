export type ParameterType = "string" | "number" | "boolean";

export interface ParameterMetadata {
    name: string;
    type: ParameterType;
    required: boolean;
}

export interface RegistryEntry {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fn: (...args: any[]) => Promise<unknown>;
    params: ParameterMetadata[];
}

export type Registry = Record<string, RegistryEntry>;

export type ResponseStatus =
    | "OK"
    | "NOT_FOUND"
    | "INVALID_PARAMS"
    | "INTERNAL_ERROR";

export type SourceType = "ws" | "http" | "mcp";
