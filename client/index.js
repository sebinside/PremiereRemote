// Loading CS Interface and express via npm
const csInterface = new CSInterface();
const loc = window.location.pathname;
const dir = decodeURI(loc.substring(1, loc.lastIndexOf('/')));
const express = require(dir + "/node_modules/express/index.js");

function init() {

    // Setup server
    const app = express();
    const port = SERVER_PORT;
    const router = express.Router();

    // Setup endpoints
    for (const functionDeclaration in host) {
        const key = functionDeclaration;
        const signature = host[key].toString().split("{")[0];

        if (signature === host[key].toString()) {
            console.log("Unable to read function definition of '" + key + "'.");
        } else {

            const parameters = extractParameters(signature);

            router.get('/' + key, function (req, res) {

                // Special code for faster debugging
                if (key === "kill") {
                    res.json({message: 'ok.'});
                    csInterface.closeExtension();
                }

                // Count request query parameters
                let propertyCount = 0;
                for (const propName in req.query) {
                    if (req.query.hasOwnProperty(propName)) {
                        propertyCount++;
                    }
                }

                // Extract request query parameters
                let params = [];
                for (const id in parameters) {
                    const propName = parameters[id];
                    if (req.query.hasOwnProperty(propName)) {
                        params.push(req.query[propName]);
                    } else {
                        console.log("Param not found: '" + propName + "'");
                    }
                }

                // Check query parameter count
                if (parameters.length === params.length && params.length === propertyCount) {
                    res.json({message: 'ok.'});

                    // Execute function with given parameters
                    executeCommand(key, params);
                } else {
                    res.json({message: 'error. wrong parameters.'});
                }

            });
        }
    }

    // Start server
    app.use('/', router);
    app.listen(port);

    document.getElementById("statusContainer").innerHTML = "Ready!";
    document.getElementById("statusContainer").className = "green";
}

const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
const ARGUMENT_NAMES = /([^\s,]+)/g;

function extractParameters(signature) {
    const fnStr = signature.toString().replace(STRIP_COMMENTS, '');
    let result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
    if (result === null)
        result = [];
    return Array.prototype.slice.call(result);
}

function executeCommand(command, params) {
    console.log("Execute: " + command);
    document.getElementById("lastCommandContainer").innerHTML = command;

    command += "(";
    for (let i = 0; i < params.length; i++) {
        command += '"' + params[i] + '"';

        if (i < (params.length - 1)) {
            command += ", ";
        }
    }
    command += ")";

    console.log(command);
    csInterface.evalScript("host." + command);
}

function openHostWindow() {
    console.log('start "' + dir + '"');
    require('child_process').exec('start "" "' + dir + '/../host"');
}