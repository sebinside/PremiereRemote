import { vi } from "vitest";
import type { Bridge } from "../../src/servers/uxpBridge.js";

export function mockBridge(): Bridge {
    return {
        isConnected: vi.fn().mockReturnValue(true),
        sendToUxp: vi.fn(),
    };
}
