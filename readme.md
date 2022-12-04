# PremiereRemote - Customizable remote access to Adobe Premiere Pro CEP.

![CEP Version](https://img.shields.io/badge/CEP%20Version-11.0-yellow) 
![Premiere Version](https://img.shields.io/badge/Premiere%20Version-2021-orange)
[![Custom](https://img.shields.io/badge/Custom%20Functionality-Available-green)](https://github.com/sebinside/PremiereRemote/tree/custom)

Using the [Adobe Premiere Extension mechanism](https://github.com/Adobe-CEP), **PremiereRemote** provides a framework to trigger your own Premiere CEP-based functionality from outside of Premiere, e.g., by using [AutoHotkey](https://autohotkey.com/). This is achieved with a server that is started inside of Premiere on your local machine. Any custom functionality can then be triggerd using a local http request.

Let's take a custom function like locking a video track inside of Premiere Pro. Unfortunately, there are no shortcuts available without modification. With CEP, you can define your own javascript function using extendscript:

```js
function lockVideoLayer(layerNumber) {
  app.enableQE();
  var activeSequence = qe.project.getActiveSequence();
  var someTrack = activeSequence.getVideoTrackAt(layerNumber);
  someTrack.setLock(true);
}
```

Using **PremiereRemote**, you can now easily trigger this function from outside of Premiere Pro with a http request. The required endpoint is generated automaticaly. In the case of the function `lockVideoLayer` presented above: 

```
$ curl "http://localhost:8081/lockVideoLayer?layerNumber=3"
```

Of course, you can also embed this line of code in a AHK-script or even remote control your Premiere instace. Sounds interesting? Let's get started!

**⚠️ The following documentation is partly outdated and will be updated soon™️ ⚠️**

## Getting started

This short guide will show how to install and use the AHK2PremiereCEP-Framework.

1. Start by cloning or downloading this repository. There is a [ready-to-use-version](https://github.com/sebinside/AHK2PremiereCEP/releases) available.

	Please note: This project uses npm to manage dependencies like the `express` web server. Don't forget to run `npm install` on the console inside the `client` folder. For more information, head over to https://nodejs.org/

2. Follow [this documentation](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_8.x/Documentation/CEP%208.0%20HTML%20Extension%20Cookbook.md) to install the extension. Basicaly, you have to:

     1. Use `regedit` to allow the execution of unsigned Adobe Premiere extensions.
     2. Copy the downloaded code inside of an extension folder, described [here](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_8.x/Documentation/CEP%208.0%20HTML%20Extension%20Cookbook.md#extension-folders). E.g. `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\AHK2PremiereCEP`.
     3. (Re) start Premiere.
3. Now, you should see the Framework under `Window` -> `Extensions`. If there is no entry, you might recheck the documentation and compare your premiere version / setup with the `manifest.xml`- file, located inside the `CSXS`- folder. 

4. Double click the extension window. This should open the plugins `host`- folder with a file named `index.jsx` in it. Here, you can define your own CEP functions. Please stick to the format already used to ensure correct parsing and server setup from the framework-side. You have to reopen the extension to load any changes. A semi-minimal index.jsx-file looks like this:

   ```
   var host = {
       kill: function () {
           // This method is only there for debugging purposes.
       },
       yourNewFunction: function(param1, param2) {
           alert(param1 + " " + param2);
       } // etc.
   }
   ```

   In newer versions there will be more code inside of the JSX-File. You can ignore or simply delete it, I just upload my very own functions to this repository!
   

## Using AutoHotkey

Now, you are ready to connect your own Premiere CEP functions, defined in the `index.jsx`-file to autohotkey. Test the REST-like endpoints in the browser of your choice, as shown above. E.g. use chrome and the url:

```
http://localhost:8081/yourNewFunction?param1=Hello&param2=World
```

On Windows 10, you can easily trigger this URL using the curl-functionality. AHK-Code wrapping this line would look like this:

```
F11::
	Run curl ""http://localhost:8081/yourNewFunction?param1=Hello&param2=World"",,hide
	return
```

Quite easy, isn't it? Of course, you can change the port on your localhost. Have a look at the `index.html`- file for this.

## Development Workflow

Although, this framework enables faster integration of new, custom made CEP functions, the development workflow isn't that great. Here is my workflow for easy debugging:

1. Start developing your new function using the *Adobe ExtendScript Toolkit*. Just specify `Adobe Premiere CC` as targed and you're ready to go with your own javascript CEP code.
2. After finishing with the development and testing of your new function, copy & paste the code inside the `index.jsx`-file. Then, reopen the extension and test it again using a browser, as shown above.
3. You might use *derkalaenders* [CEPReloader](https://github.com/derkalaender/CEPReloader) for easier reopening of extensions. It speeds up the workflow quite a bit. The `kill` - function, shown above, does only exist for this integration. If you don't want to use the reloader-extension, you can delete the kill-functionality inside of the framework.
4. Last but not least, these extensions enables debugging by default. Using chrome web debugger, you can simply connect to `http://localhost:8004` (by default) and see the javascript console output in real time.

### Typescript Support

OPTIONAL: There is a version with typescript support available, based on [Types-for-Adobe](https://github.com/pravdomil/Types-for-Adobe). To work with this version, please checkout the branch `rework`. Install the typescript compiler `tsc`, use `npm install` again in the `host` folder and `npm run-script run` to start typescript compilation from the `index.tsx` to `index.jsx`. Although this version is more advanced, type support might be worth the extra effort.

## More

If you want learn more about using AutoHotkey and the Adobe CEP SDK, have a look at this:

* Adobe CEP Premiere Samples: https://github.com/Adobe-CEP/Samples/blob/master/PProPanel/jsx/PPRO/Premiere.jsx
* Premiere On Script, a Premiere CEP youtube channel: https://www.youtube.com/channel/UCmq_t_-4GLFu_nYaEDDModw
* Taran Van Hemert, a macro specialist: https://www.youtube.com/user/TaranVH
* And my own twitch channel, were I develop with these techniques, sometimes: https://www.twitch.tv/skate702

If there are more questions, you can contact me on [Twitter](https://twitter.com/skate702) or via [mail](mailto:hi@sebinside.de).
