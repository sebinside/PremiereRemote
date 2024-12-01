// Loading CS Interface and express via npm
const csInterface = new CSInterface();
const loc = window.location.pathname;
const dir = decodeURI(loc.substring(1, loc.lastIndexOf('/')));

// Dependencies
const express = require(dir + "/node_modules/express/index.js");
const swaggerJsDoc = require(dir + "/node_modules/swagger-jsdoc/index.js");
const swaggerUi = require(dir + "/node_modules/swagger-ui-express/index.js");
const websocket = require(dir + "/node_modules/ws/index.js");

function init() {
    console.log("Starting PremiereRemote initialization...");

    // Setup server
    console.log("Starting PremiereRemote server setup...");
    const app = express();
    const router = express.Router();
    console.log("Finished PremiereRemote server setup.");

    // Setup swagger endpoint
    console.log("Starting Swagger setup...");
    setupSwagger(app);
    console.log("Finished Swagger setup.");

    // Setup endpoints
    console.log("Starting API endpoint setup...");
    for (const functionDeclaration in host) {
        const key = functionDeclaration;
        const signature = host[key].toString().split("{")[0];
        console.log(`Setting up endpoint: "${key}".`);

        if (signature === host[key].toString()) {
            console.error("Unable to read function definition of '" + key + "'.");
        } else {

            const parameters = extractParameters(signature);

            router.get('/' + key, function (req, res) {

                // Special code for faster debugging
                if (key === "kill") {
                    res.json({ message: 'ok.' });
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
                        console.error("Param not found: '" + propName + "'");
                    }
                }

                // Check query parameter count
                if (parameters.length === params.length && params.length === propertyCount) {
                    executeCommand(key, params, res);
                } else {
                    res.json({ message: 'error. wrong parameters.' });
                }

            });
        }
    }
    console.log("Finished API endpoint setup.")

    console.log("Starting WebSocket server setup...");
    setupWebSocketServer();
    console.log("Finished WebSocket server setup.");

    // Start server
    console.log(`Starting the PremiereRemote server now on port ${SERVER_PORT}.`);
    app.use('/', router);
    app.listen(SERVER_PORT);

    // Enable QE
    if (ENABLE_QE) {
        console.log("Enabling the undocumented QE API. Be careful!")
        csInterface.evalScript("framework.enableQualityEngineering();")
    }

    document.getElementById("statusContainer").innerHTML = "Ready!";
    document.getElementById("statusContainer").className = "green";

    console.log("Finished PremiereRemote initialization.")
}

function setupWebSocketServer() {
    console.log(`Starting the PremiereRemote websocket server now on port ${WS_SERVER_PORT}.`);
    const wss = new websocket.WebSocketServer({ port: WS_SERVER_PORT });

    wss.on('connection', function connection(ws) {
      ws.on('error', console.error);
    
      ws.on('message', function message(data) {
        const parts = String(data).split(",");
        if(parts.length !== 2) {
            console.error("Invalid websocket message format. Expected: 'command,value'");
        } else {
            document.getElementById("lastCommandContainer").innerHTML = `ws:${parts[0]}(${parts[1]})`;
            csInterface.evalScript(`host.${parts[0]}(${parts[1]});`);
        }
      });
    });
}

function setupSwagger(swaggerApp) {
    const options = {
        swaggerDefinition: {
            info: {
                title: 'PremiereRemote',
                version: PREMIERE_REMOTE_VERSION,
                description: 'Customizable remote access to Adobe Premiere Pro CEP.',
            },
        },
        // List of files to be processed
        apis: [dir + '/../host/build/index.jsx'],
    };

    const specs = swaggerJsDoc(options);
    swaggerApp.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
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

function executeCommand(command, params, res) {
    console.log(`Retrieved endpoint call: "${command}"`);
    document.getElementById("lastCommandContainer").innerHTML = command;

    command += "(";
    for (let i = 0; i < params.length; i++) {
        command += '"' + params[i] + '"';

        if (i < (params.length - 1)) {
            command += ", ";
        }
    }
    command += ");";

    console.log(`Execute command: "${command}"`);
    csInterface.evalScript("host." + command, function (functionResult) {
        if(res) {
            res.json({ message: 'ok.', result: functionResult });
        }
    });
}

function openHostWindow() {
    console.log(`Opening explorer window for host folder inside "${dir}".`);
    require('child_process').exec('start "" "' + dir + '/../host"');
}
