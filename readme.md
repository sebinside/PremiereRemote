# AHK to Premiere CEP

Using the Adobe Premiere Extension mechanism, this project provides a framework to trigger your own Premiere CEP functions from outside of Premiere, e.g. from [AutoHotkey](https://autohotkey.com/). This is achieved by using a RESTful-like service, started inside Premiere on your localhost. Every custom function can then be triggerd using a local http request.

Let's take a custom function like locking a video track inside of Premiere. Without CEP, you have to use image recognition or similiar techniques. With CEP, you can define your own javascript function using extendscript:

```
function lockVideoLayer(layerNumber) {
    // ...
}
```

Using this framework, you can now easily trigger this function from outside of premiere with a http request. The required REST-like endpoint is generated automaticaly. In this case, e.g.:

```
$ curl "http://localhost:8081/lockVideoLayer?layerNumber=3"
```

Of course, you can also embed this line of code in a AHK-script. Sounds interesting? Let's get started!

## Getting started

This short guide will show how to install and use the AHK2PremiereCEP-Framework.

1. Start by cloning or downloading this repository. There is an [ready-to-use-version](https://github.com/sebinside/AHK2PremiereCEP/releases) available.

2. Follow [this documentation](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_8.x/Documentation/CEP%208.0%20HTML%20Extension%20Cookbook.md) to install the extension. Basicaly, you have to:

     1. Use `regedit` to allow the execution of unsigned adobe extensions.
     2. Copy the downloaded code inside of an extension folder, described [here](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_8.x/Documentation/CEP%208.0%20HTML%20Extension%20Cookbook.md#extension-folders). E.g. `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\AHK2PremiereCEP`.
     3. (Re) start Premiere.
  3. Now, you should see the Framework under `Window` -> `Extensions`. If there is no enry, you might recheck the documentation and compare your premiere version / setup with the `manifest.xml`- file, located inside the `CSXS`- folder. 

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

   In newer versions, there will be more code inside of the JSX-File. You can ignore or simply delete it, I just upload my very own functions to this repository!

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
2. After finishing with the development and testing of your new function, copy & paste the code inside the `index.jsx`file. Then, reopen the extension and test it again using a browser, as shown above.
3. You might use *derkalaenders* [CEPReloader](https://github.com/derkalaender/CEPReloader) for easier reopening of this extensions. It speeds up the workflow quite a bit. The `kill` - function, shown above, does only exist for this integration. If you don't want to use the reloader-extension, you can delete the kill-functionality inside of the framework.
4. Last but not least, this extensions enables debugging by default. Using chrome web debugger, you can simply connect to `http://localhost:8004` (by default) and see the javascript console output in real time.

## More

If you want learn more about using AutoHotkey and the Adobe CEP SDK, have a look at this:

* Adobe CEP Premiere Samples: https://github.com/Adobe-CEP/Samples/blob/master/PProPanel/jsx/PPRO/Premiere.jsx
* Premiere On Script, a Premiere CEP youtube channel: https://www.youtube.com/channel/UCmq_t_-4GLFu_nYaEDDModw
* Taran Van Hermet, a macro specialist: https://www.youtube.com/user/TaranVH
* And my own twitch channel, were I develop with this techniques, sometimes: https://www.twitch.tv/skate702

If there are more questions, you can contact me on [Twitter](https://twitter.com/skate702) or via [mail](mailto:hi@sebinside.de).