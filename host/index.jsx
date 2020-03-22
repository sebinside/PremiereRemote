/// <reference path="../typings/JavaScript.d.ts"/>
/// <reference path="../typings/PlugPlugExternalObject.d.ts"/>
/// <reference path="../typings/PremierePro.14.0.d.ts"/>
/// <reference path="../typings/XMPScript.d.ts"/>
/// <reference path="../typings/extendscript.d.ts"/>
/// <reference path="../typings/global.d.ts"/>
var MarkerUtils = /** @class */ (function () {
    function MarkerUtils() {
    }
    MarkerUtils.addCustomMarker = function (color) {
        var currentSequence = app.project.activeSequence;
        var markerLayer = currentSequence.videoTracks[currentSequence.videoTracks.numTracks - 1];
        Utils.fixPlayHeadPosition(Utils.projectFrameRate);
        var currentPlayheadPosition = currentSequence.getPlayerPosition();
        var markerChild = Utils.getMarkerItemInMarkerFolder(color);
        if (markerChild === undefined) {
            alert("No 'marker' folder found. Please use a viable preset.");
        }
        else {
            markerLayer.overwriteClip(markerChild, currentPlayheadPosition);
        }
    };
    MarkerUtils.loadMarkersFromCSVFile = function () {
        var csvFileDialog = File.openDialog("Target CSV File", "*.csv");
        var csvFile = csvFileDialog.fsName;
        var currentSequence = app.project.activeSequence;
        var markerLayer = currentSequence.videoTracks[currentSequence.videoTracks.numTracks - 1];
        var currentPlayheadPosition = currentSequence.getPlayerPosition();
        if (csvFile) {
            var file = File(csvFile);
            file.open("r");
            var fullText = file.read();
            file.close();
            var lines = fullText.split("\n");
            for (var i = 0; i < lines.length; i++) {
                var entry = lines[i].split(",");
                if (entry.length === 7) {
                    // Parse csv
                    var seconds = parseInt(entry[0]) * 3600 +
                        parseInt(entry[1]) * 60 +
                        parseInt(entry[2]) +
                        parseInt(entry[3]) / 1000;
                    var mode = entry[4];
                    var message = entry[5];
                    var color = entry[6];
                    // Insert clip
                    var markerChild = Utils.getMarkerItemInMarkerFolder(color);
                    var targetInSeconds = currentPlayheadPosition.seconds + seconds;
                    markerLayer.overwriteClip(markerChild, targetInSeconds);
                    // Retrieve clip
                    var clip = Utils.getLastUnnamedMarkerClip();
                    // Set name
                    clip.name = message;
                    // Set length
                    if (mode === "mode") {
                        // If mode == mode, get next item with mode mode and calculate length
                        var nextItemSeconds = -1;
                        for (var j = i + 1; j < lines.length; j++) {
                            var newEntry = lines[j].split(",");
                            var nextSeconds = parseInt(newEntry[0]) * 3600 +
                                parseInt(newEntry[1]) * 60 +
                                parseInt(newEntry[2]) +
                                parseInt(newEntry[3]) / 1000;
                            var nextMode = newEntry[4];
                            if (nextMode === "mode") {
                                nextItemSeconds = nextSeconds;
                                break;
                            }
                        }
                        if (nextItemSeconds > 0) {
                            var endTime = new Time();
                            endTime.seconds =
                                nextItemSeconds + currentPlayheadPosition.seconds;
                            clip.end = endTime; // not my fault, types problem
                        }
                    }
                }
            }
        }
    };
    MarkerUtils.saveCustomMarkerToTextFile = function () {
        var currentSequence = app.project.activeSequence;
        var markerLayer = currentSequence.videoTracks[currentSequence.videoTracks.numTracks - 1];
        var markerClips = markerLayer.clips;
        var markerCount = markerClips.numItems;
        var projectName = app.project.name;
        var output = "Project: " + projectName + "\n";
        output += "Sequence: " + currentSequence.name + "\n";
        output += "Marker count: " + markerCount + "\n\n";
        for (var i = 0; i < markerCount; i++) {
            var clip = markerClips[i];
            var trueSeconds = parseInt("" + clip.start.seconds);
            var hours = parseInt("" + trueSeconds / 3600);
            trueSeconds -= hours * 3600;
            var minutes = parseInt("" + trueSeconds / 60);
            trueSeconds -= minutes * 60;
            var seconds = trueSeconds;
            if (hours > 0) {
                output += Utils.pad(hours, 2) + ":";
            }
            output += Utils.pad(minutes, 2) + ":";
            output += Utils.pad(seconds, 2) + " - ";
            output += clip.name + "\n";
        }
        try {
            var file = new File();
            var fileNew = file.saveDlg("Save new file", "*.txt");
            fileNew.encoding = "UTF8";
            fileNew.open("w");
            fileNew.write(output);
            fileNew.close();
        }
        catch (error) {
            // User hit cancel
        }
    };
    MarkerUtils.selectCurrentMarker = function () {
        var clip = MarkerUtils.getCurrentMarkerClip();
        if (clip !== undefined) {
            clip.setSelected(true, true);
        }
    };
    MarkerUtils.getCurrentMarkerClip = function () {
        var currentSequence = app.project.activeSequence;
        var markerLayer = currentSequence.videoTracks[currentSequence.videoTracks.numTracks - 1];
        var markerClips = markerLayer.clips;
        var markerCount = markerClips.numItems;
        Utils.fixPlayHeadPosition(Utils.projectFrameRate);
        var currentPlayheadPosition = currentSequence.getPlayerPosition().ticks;
        for (var i = 0; i < markerCount; i++) {
            var clip = markerClips[i];
            var startTicks = clip.start.ticks;
            var endTicks = clip.end.ticks;
            if (parseInt(startTicks) <= parseInt(currentPlayheadPosition) &&
                parseInt(currentPlayheadPosition) < parseInt(endTicks)) {
                return clip;
            }
        }
    };
    MarkerUtils.deselectAll = function () {
        var currentSequence = app.project.activeSequence;
        for (var i = 0; i < currentSequence.videoTracks.numTracks; i++) {
            var track = currentSequence.videoTracks[i];
            for (var j = 0; j < track.clips.numItems; j++) {
                var clip = track.clips[j];
                clip.setSelected(false, true);
            }
        }
        for (var i = 0; i < currentSequence.audioTracks.numTracks; i++) {
            var track = currentSequence.videoTracks[i];
            for (var j = 0; j < track.clips.numItems; j++) {
                var clip = track.clips[j];
                clip.setSelected(false, true);
            }
        }
    };
    return MarkerUtils;
}());
var Utils = /** @class */ (function () {
    function Utils() {
    }
    Utils.fixPlayHeadPosition = function (frameRate) {
        var currentSequence = app.project.activeSequence;
        var currentPlayheadPosition = currentSequence.getPlayerPosition().ticks;
        var ticksPerSecond = 254016000000;
        var ticksPerFrame = ticksPerSecond / frameRate;
        var newPos = Math.ceil(parseInt(currentPlayheadPosition) / ticksPerFrame);
        currentSequence.setPlayerPosition(String(newPos * ticksPerFrame));
    };
    Utils.pad = function (num, size) {
        var s = num.toString();
        while (s.length < size)
            s = "0" + s;
        return s;
    };
    Utils.getProjectItemInRoot = function (itemName) {
        var projectItem = undefined;
        for (var i = 0; i < app.project.rootItem.children.numItems; i++) {
            var child = app.project.rootItem.children[i];
            if (child.name === itemName) {
                projectItem = child;
                break;
            }
        }
        return projectItem;
    };
    Utils.getMarkerItemInMarkerFolder = function (markerColor) {
        for (var i = 0; i < app.project.rootItem.children.numItems; i++) {
            var child = app.project.rootItem.children[i];
            if (child.name === "marker") {
                for (var j = 0; j < child.children.numItems; j++) {
                    var markerChild = child.children[j];
                    if (markerChild.name === markerColor) {
                        return markerChild;
                    }
                }
            }
        }
        return undefined;
    };
    Utils.getLastUnnamedMarkerClip = function () {
        var currentSequence = app.project.activeSequence;
        var markerLayer = currentSequence.videoTracks[currentSequence.videoTracks.numTracks - 1];
        var markerClips = markerLayer.clips;
        var markerCount = markerClips.numItems;
        var lastMarker = markerClips[markerCount - 1];
        debugger;
        // Dirty coded dirty hack, premiere is... not exact with its ticks?!
        // If last marker has no name = This is my new marker. If it has a name -> stretched mode marker
        if (lastMarker.name === "0" ||
            lastMarker.name === "1" ||
            lastMarker.name === "2" ||
            lastMarker.name === "3" ||
            lastMarker.name === "4" ||
            lastMarker.name === "5" ||
            lastMarker.name === "6" ||
            lastMarker.name === "7" ||
            lastMarker.name === "8" ||
            lastMarker.name === "9" ||
            lastMarker.name === "10" ||
            lastMarker.name === "11" ||
            lastMarker.name === "12" ||
            lastMarker.name === "13" ||
            lastMarker.name === "14" ||
            lastMarker.name === "15") {
            return lastMarker;
        }
        return markerClips[markerCount - 2];
    };
    Utils.projectFrameRate = 24;
    return Utils;
}());
/**
 * ALL functions defined here are visible via the localhost REST-like service.
 */
var host = {
    /**
     * @swagger
     *
     * /kill:
     *      get:
     *          description: This method is only there for debugging purposes.
     *                       For more information, please have a look at the index.js file.
     */
    kill: function () { },
    /**
     * @swagger
     * /addCustomMarker?color={color}:
     *      get:
     *          description: Adds a new marker (NO normal marker, a settings layer, see above) to the current playhead position.
     *          parameters:
     *              - name: color
     *                description: the color of the custom marker, between 0 - 15 (see premiere color labels)
     *                in: path
     *                type: string
     */
    addCustomMarker: function (color) {
        MarkerUtils.addCustomMarker(color);
    },
    /**
     * @swagger
     * /loadMarkersFromCSVFile:
     *      get:
     *          description: Loads serialized marker information from a CSV file, creates top layer markers for it.
     *                       Note_ To work properly, a marker-bin with 15 setting layers (all 15 colors) is required.
     */
    loadMarkersFromCSVFile: function () {
        MarkerUtils.loadMarkersFromCSVFile();
    },
    /**
     * @swagger
     * /saveCustomMarkerToTextFile:
     *      get:
     *          description: Saves all custom markers (top track settings layers, see above) to a specified file (Open File Dialog).
     */
    saveCustomMarkerToTextFile: function () {
        MarkerUtils.saveCustomMarkerToTextFile();
    },
    /**
     * @swagger
     * /selectCurrentMarker:
     *      get:
     *          description: Selects the current marker at playhead position.
     *                       Short explanation I use the topmost video track with setting layer as markers due to the better support in premiere.
     */
    selectCurrentMarker: function () {
        MarkerUtils.selectCurrentMarker();
    },
    /**
     * @swagger
     * /deselectAll:
     *      get:
     *          description: Deselects all video and audio clips
     */
    deselectAll: function () {
        MarkerUtils.deselectAll();
    }
};
/**
 * These functions are only used internally.
 */
var framework = {
    enableQualityEngineering: function () {
        app.enableQE();
    }
};
