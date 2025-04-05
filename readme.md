<p align="center">
  <h3 align="center"><a href="https://github.com/sebinside/PremiereRemote/releases"><img src = "premiereremote-logo.png"/></a><br>
  <a href="https://github.com/sebinside/PremiereRemote/releases">🔗 Download Release</a></h3>
</p>
<p>&nbsp;</p>

## PremiereRemote - Customizable remote access to Adobe Premiere Pro CEP

![CEP Version](https://img.shields.io/badge/CEP%20Version-12.0-yellow) 
![Premiere Version](https://img.shields.io/badge/Premiere%20Version-25.2-orange)
[![Custom](https://img.shields.io/badge/Custom%20Functionality-Available-green)](https://github.com/sebinside/PremiereRemote/tree/custom/host/src)

Using the [Adobe Premiere Extension mechanism](https://github.com/Adobe-CEP), **PremiereRemote** provides a framework to trigger your own Premiere CEP-based functionality from outside of Premiere, e.g., by using [AutoHotkey](https://autohotkey.com/). This is achieved with a server that is started inside of Premiere on your local machine. Any custom functionality can then be triggerd using a local http request or using websockets.

Let's take a custom function like locking a video track inside of Premiere Pro. Unfortunately, there are no shortcuts available without modification. With CEP, you can define your own javascript function using extendscript:

```js
function lockVideoLayer(layerNumber) {
  app.enableQE();
  var activeSequence = qe.project.getActiveSequence();
  var someTrack = activeSequence.getVideoTrackAt(layerNumber);
  someTrack.setLock(true);
}
```

Using **PremiereRemote**, you can now easily trigger this function from outside of Premiere Pro with a http request. The required endpoint is generated automaticaly. In the case of the default port `8081` and the function `lockVideoLayer` presented above: 

```bash
$ curl "http://localhost:8081/lockVideoLayer?layerNumber=3"
```

Of course, you can also embed this line of code in a AHK-script or even remote control your Premiere instance from another computer. Sounds interesting? Let's get started!


## Installation

This short guide will show how to install and use the **PremiereRemote** framework.

0. Preconditions: Please make sure that your Adobe Premiere Pro version matches the version shown in the README file. Other versions might work but could break things. Also, this framework requires [NodeJS](https://nodejs.org). Please install the current version, and verify that it is usable by, e.g., typing `npm --version`.

1. Start by cloning or downloading this repository. There is a [ready-to-use-version](https://github.com/sebinside/PremiereRemote/releases) available.

2. Follow [this documentation](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_12.x/Documentation/CEP%2012%20HTML%20Extension%20Cookbook.md) to install the extension. Basically, you have to:

     1. Use `regedit` to allow the execution of unsigned Adobe Premiere extensions as described [here](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_12.x/Documentation/CEP%2012%20HTML%20Extension%20Cookbook.md#debugging-unsigned-extensions).
     2. Copy the downloaded code inside of an extension folder, described [here](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_12.x/Documentation/CEP%2012%20HTML%20Extension%20Cookbook.md#extension-folders), e.g., `C:\Users\<USERNAME>\AppData\Roaming\Adobe\CEP\extensions\PremiereRemote`.
     
3. Install the required dependencies to use **PremiereRemote**. 

     1. Open a console window in the `PremiereRemote\client` folder. Execute `npm i` to install all dependencies. These dependencies are used to run the local web server inside of Premiere. 
     2. Open a console window in the `PremiereRemote\host` folder. Execute `npm i` to install all dependencies. These dependencies are used for the development workflow.
     3. In the same console window in the `PremiereRemote\host` folder, execute `npm run build`. This should generate a folder called `build`, where your custom functionality is contained.

4. (Re) start Adobe Premiere Pro.

3. Now, you should see the Framework under `Window` -> `Extensions`. If there is no entry, you might recheck the documentation and compare your premiere version / setup with the `manifest.xml`- file, located inside the `CSXS`- folder. 

4. Double click the extension window. This should open the plugins `host`- folder. Inside the folder `src`, you can add your own functionality, e.g., in the `index.tsx`. Please stick to the format already used to ensure correct parsing and server setup from the framework-side. A semi-minimal `index.tsx`-file looks like this:

   ```js
   export const host = {
       kill: function () {
           // This method is only there for debugging purposes and shall not be replaced.
       },
       yourNewFunction: function(param1, param2) {
           alert(param1 + " " + param2);
       }
   }
   ```
   
   After making changes in any `.tsx` files, repeat the process of running `npm run build` from inside the `PremiereRemote\host` folder. You also have to close and repoen the **PremiereRemote** extension via `Window` -> `Extensions`. Note, that a restart of Premiere Pro is usually not required.
   
   There is more custom functionality available as inspiration or to directly use [here](https://github.com/sebinside/PremiereRemote/tree/custom/host/src).


## Usage

Now, you are ready to call your own Premiere CEP functions, defined in the `host` variable of the `index.tsx`-file remotely. 
There are two ways to trigger PremiereRemote functionality from outside: Using HTTP requests or using WebSocket calls.

### HTTP Requests

Test the endpoints in the browser of your choice, as shown above. For example, use Chrome and the url:

```
http://localhost:8081/yourNewFunction?param1=Hello&param2=World
```

There is support for a [Swagger](https://swagger.io/)-based user interface (UI) to trigger your functionality. This UI is generated based on the annotations of the functions inside the `host` variable of the `index.tsx` file. By default, it is also hosted by the internal Premiere Pro server at `http://localhost:8081/api-docs/`. It is highly recommended to annotate your functions to simplify their usage (also, by you :)).

On Windows 10 and later, you can easily trigger the URLs using the `curl`-functionality. [AutoHotkey](https://autohotkey.com/) code wrapping the `curl` process would look like this:

```autohotkey
F11::
	Run curl ""http://localhost:8081/yourNewFunction?param1=Hello&param2=World"",,hide
	return
```

Quite easy, isn't it? Of course, you can change the port on your localhost. Have a look at the `index.html`- file for this. Also, AutoHotkey is only one example on how your custom Premiere Pro functionality can be called. Any application that can execute HTTP-requests is capable of triggering your functions.

Additionally, it is possible to return values from inside of Premiere Pro, by returning their serialized representation at the end of a function inside the `index.tsx` file. An example JSON-based result can look like this:

```javascript
{"message":"ok.","result":"5"}
```

### WebSocket

Since the release of `v2.1.0`, a WebSocket server was added to PremiereRemote.
This enables you to trigger CEP code with minimal delay, e.g., when integrating PremiereRemote with Controller Hardware like the Elgato Stream Deck +.
Any function that can be called via HTTP (see above) can also be called via WebSocket using port `8082` by default.
See this simple example:

```javascript
import WebSocket from 'ws';
const websocketAddress = 'ws://localhost:8082';
const ws = new WebSocket(websocketAddress);
ws.send(`yourNewFunction,Hello,World`);
```

This code snippet would connect to the WebSocket server and call a CEP function named `yourNewFunction` with the parameters `Hello` and `World`. Any number of parameters (including zero) are allowed.

## Development

Here is my workflow for easy development and debugging of your own [CEP](https://github.com/Adobe-CEP)-based functionality:

1. Start developing your new function using the [ExtendScript Debugger](https://marketplace.visualstudio.com/items?itemName=Adobe.extendscript-debug) extension for [Visual Studio Code](https://code.visualstudio.com/). Just specify Adobe Premiere as targed and you're ready to go with your own javascript CEP code.
2. After finishing with the development and testing of your new function, copy & paste the code inside the `index.tsx`-file. Alternatively, you can use multiple files to organize your code, as demonstrated [here](https://github.com/sebinside/PremiereRemote/tree/custom/host/src).
3. After making changes in any `.tsx` files, repeat the process of running `npm run build` from inside the `PremiereRemote\host` folder. 
4. Then, reopen the **PremiereRemote** extension via `Window` -> `Extensions` and test it again, e.g., by using a browser, as shown above.
5. Optional: This extension enables debugging by default. Using chrome web debugger, you can simply connect to `http://localhost:8708` (by default) and see the javascript console output in real time (see the `.debug` file).

Custom functionality inside the `host` folder is written in TypeScript and is based on [Types-for-Adobe](https://github.com/pravdomil/Types-for-Adobe).

## More

If you want learn more about using the Adobe CEP SDK or AutoHotkey, have a look at this:

* Adobe CEP Premiere Samples: https://github.com/Adobe-CEP/Samples/blob/master/PProPanel/jsx/PPRO/Premiere.jsx
* Premiere On Script, a Premiere CEP YouTube channel: https://www.youtube.com/channel/UCmq_t_-4GLFu_nYaEDDModw
* Taran Van Hemert, a macro specialist: https://www.youtube.com/user/TaranVH
* And my own twitch channel, were I develop with these techniques, sometimes: https://www.twitch.tv/skate702

If there are more questions, you can contact me on [Twitter](https://twitter.com/skate702) or via [mail](mailto:hi@sebinside.de).
