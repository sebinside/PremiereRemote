import { describe, it, expect, vi } from "vitest";
import {
    log,
    logError,
    logIncomingCall,
    logOutgoingResult,
    logAndExit,
} from "../src/log.js";

describe("log", () => {
    it("prefixes the message with the padded server label", () => {
        const spy = vi.spyOn(console, "log").mockImplementation(() => {});
        log("Test", "did a thing");
        expect(spy).toHaveBeenCalledWith("[Test] did a thing");
        spy.mockRestore();
    });
});

describe("logError", () => {
    it("prefixes the message with the padded server label", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        logError("Test", "went wrong:", "details");
        expect(spy).toHaveBeenCalledWith("[Test] went wrong:", "details");
        spy.mockRestore();
    });
});

describe("logAPICall", () => {
    it("logs the actionId with its params, tagged with the server", () => {
        const spy = vi.spyOn(console, "log").mockImplementation(() => {});
        logIncomingCall("Test", "some/action", { foo: "bar" });
        expect(spy).toHaveBeenCalledWith("[Test] → some/action", {
            foo: "bar",
        });
        spy.mockRestore();
    });

    it("logs '(no params)' when params is empty", () => {
        const spy = vi.spyOn(console, "log").mockImplementation(() => {});
        logIncomingCall("Test", "some/action", {});
        expect(spy).toHaveBeenCalledWith("[Test] → some/action", "(no params)");
        spy.mockRestore();
    });
});

describe("logAPIResult", () => {
    it("logs the actionId with its result, tagged with the server", () => {
        const spy = vi.spyOn(console, "log").mockImplementation(() => {});
        logOutgoingResult("Test", "some/action", {
            id: "1",
            status: "OK",
        });
        expect(spy).toHaveBeenCalledWith("[Test] ← some/action", {
            id: "1",
            status: "OK",
        });
        spy.mockRestore();
    });
});

describe("logAndExit", () => {
    it("logs the label and error message, then exits with code 1", () => {
        const errorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
        const exitSpy = vi
            .spyOn(process, "exit")
            .mockImplementation(() => undefined as never);

        logAndExit("Test")(new Error("boom"));

        expect(errorSpy).toHaveBeenCalledWith(
            "[Test] failed to start:",
            "boom",
        );
        expect(exitSpy).toHaveBeenCalledWith(1);

        errorSpy.mockRestore();
        exitSpy.mockRestore();
    });
});
