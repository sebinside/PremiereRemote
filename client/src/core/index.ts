import { registry } from "../generated/registry.js";
import { resetUI, ui } from "./ui.js";
import { WsClient } from "./wsClient.js";

console.log("PremiereRemote UXP plugin starting...");
resetUI();
new WsClient(registry, ui).start();
