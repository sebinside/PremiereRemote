import { resetUI } from "./ui.js";
import { startWsClient } from "./wsClient.js";

console.log("PremiereRemote UXP plugin starting...");
resetUI();
startWsClient();
