import "./ui.js";
import "../actions/common.js";
import { getActiveSequence, getActiveSequenceName } from "../actions/common.js";
import { resetUI } from "./ui.js";

// TODO: Replace dummy testing code
console.log("hello!");
getActiveSequenceName()
    .then((name) => {
        console.log("Active sequence name:", name);
    })
    .catch((err) => {
        console.error("Error getting active sequence:", err);
    });

getActiveSequence()
    .then((sequence) => {
        console.log("Active sequence:", sequence);
    })
    .catch((err) => {
        console.error("Error getting active sequence:", err);
    });

setTimeout(() => {
    resetUI();
}, 1000);
