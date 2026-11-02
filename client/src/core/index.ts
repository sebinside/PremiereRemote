import { registry } from "../generated/registry.js";
import { ui } from "./ui.js";
import { WsClient } from "./wsClient.js";

console.log("[core] PremiereRemote UXP plugin starting...");
new WsClient(registry, ui).start();
