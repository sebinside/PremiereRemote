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

export type SourceType = "ws" | "http" | "mcp";

export type StatusState = "ok" | "warn" | "error";

export interface Status {
    state: StatusState;
    message: string;
    detail: string;
}

export interface UIInterface {
    setLastCommand(name: string, source: SourceType): void;
    setStatus(status: Status): void;
    reset(): void;
}
