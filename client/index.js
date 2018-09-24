var csInterface = new CSInterface();

var loc = window.location.pathname;
var dir = decodeURI(loc.substring(1, loc.lastIndexOf('/')));
const express = require(dir + "/node_modules/express/index.js");

const endpoint = function (router, path, command) {
  router.get(path, function(req, res) {
      res.json({ message: 'ok.' });
      csInterface.evalScript(command + "()");
    });
}

var app = express();
var port = process.env.PORT || 8081;
var router = express.Router();

endpoint(router, '/', 'sendNameAlert');

app.use('/ahk', router);
app.listen(port);
