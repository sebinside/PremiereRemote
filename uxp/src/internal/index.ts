import "./ui.js";
import "../actions/common.js";
import { getActiveSequenceName } from "../actions/common.js";
import { setStatus } from "./ui.js";

// TODO: Replace dummy testing code
console.log("hello!");
getActiveSequenceName()
    .then((name) => {
        setStatus(
            "ok",
            name ? `Active sequence: ${name}` : "No active sequence",
        );
        console.log("Active sequence name:", name);
    })
    .catch((err) => {
        setStatus("error", "Error getting active sequence");
        console.error("Error getting active sequence:", err);
    });
