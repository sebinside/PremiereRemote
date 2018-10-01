// Loading CS Interface and express via npm
const csInterface = new CSInterface();
const loc = window.location.pathname;
const dir = decodeURI(loc.substring(1, loc.lastIndexOf('/')));
const express = require(dir + "/node_modules/express/index.js");

const endpoints = [
    ["sendNameAlert", "sendNameAlert"],
    ["sendAlert", "sendAlert"]
    ];

function init() {

    // Create endpoint map
    const endpointMap = new Map(endpoints);

    // Setup server
    const app = express();
    const port = process.env.PORT || 8081;
    const router = express.Router();

    // Setup endpoints
    endpointMap.forEach(function(value, key) {
        router.get('/' + key, function(req, res) {

            let params = [];
            for (const propName in req.query) {
                if (req.query.hasOwnProperty(propName)) {
                    params.push(req.query[propName]);
                }
            }

            res.json({ message: 'ok.' });
            executeCommand(value, params);
        });
    });

    // Start server
    app.use('/', router);
    app.listen(port);

    document.getElementById("statusContainer").innerHTML = "Ready!";
    document.getElementById("statusContainer").className = "green";
}

function executeCommand(command, params) {
    console.log("Execute: " + command);
    document.getElementById("lastCommandContainer").innerHTML = command;

    command += "(";
    for(let i = 0; i < params.length; i++) {
        command += '"' + params[i] + '"';

        if(i < (params.length - 1)) {
            command += ", ";
        }
    }
    command += ")";

    console.log(command);
    csInterface.evalScript(command);
}