/// <reference path="../typings/JavaScript.d.ts"/>
/// <reference path="../typings/PlugPlugExternalObject.d.ts"/>
/// <reference path="../typings/PremierePro.14.0.d.ts"/>
/// <reference path="../typings/XMPScript.d.ts"/>
/// <reference path="../typings/extendscript.d.ts"/>
/// <reference path="../typings/global.d.ts"/>
var MarkerUtils = /** @class */ (function () {
    function MarkerUtils() {
    }
    MarkerUtils.getMarkerItemInMarkerFolder = function (markerColor) {
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
    MarkerUtils.getLastUnnamedMarkerClip = function () {
        var currentSequence = app.project.activeSequence;
        var markerLayer = currentSequence.videoTracks[currentSequence.videoTracks.numTracks - 1];
        var markerClips = markerLayer.clips;
        var markerCount = markerClips.numItems;
        var lastMarker = markerClips[markerCount - 1];
        debugger;
        if (/[0-9]+/.test(lastMarker.name)) {
            return lastMarker;
        }
        return markerClips[markerCount - 2];
    };
    MarkerUtils.addCustomMarker = function (color) {
        var currentSequence = app.project.activeSequence;
        var markerLayer = currentSequence.videoTracks[currentSequence.videoTracks.numTracks - 1];
        Utils.fixPlayHeadPosition();
        var currentPlayheadPosition = currentSequence.getPlayerPosition();
        var markerChild = MarkerUtils.getMarkerItemInMarkerFolder(color);
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
                    var markerChild = MarkerUtils.getMarkerItemInMarkerFolder(color);
                    var targetInSeconds = currentPlayheadPosition.seconds + seconds;
                    markerLayer.overwriteClip(markerChild, targetInSeconds);
                    // Retrieve clip
                    var clip = MarkerUtils.getLastUnnamedMarkerClip();
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
        Utils.fixPlayHeadPosition();
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
    Utils.getFirstSelectedClip = function (videoClip) {
        var currentSequence = app.project.activeSequence;
        var tracks = videoClip ? currentSequence.videoTracks : currentSequence.audioTracks;
        for (var i = 0; i < tracks.numTracks; i++) {
            for (var j = 0; j < tracks[i].clips.numItems; j++) {
                var currentClip = tracks[i].clips[j];
                if (currentClip.isSelected()) {
                    return { clip: currentClip,
                        trackIndex: i,
                        clipIndex: j
                    };
                }
            }
        }
        return null;
    };
    Utils.getQEVideoClip = function (trackIndex, clipIndex) {
        var currentSequence = qe.project.getActiveSequence();
        // Yes, 1-based
        return currentSequence.getVideoTrackAt(trackIndex).getItemAt(clipIndex + 1);
    };
    Utils.targetAllTracks = function (target) {
        var currentSequence = app.project.activeSequence;
        for (var i = 0; i < currentSequence.videoTracks.numTracks; i++) {
            currentSequence.videoTracks[i].setTargeted(target, true);
        }
        for (var i = 0; i < currentSequence.audioTracks.numTracks; i++) {
            currentSequence.audioTracks[i].setTargeted(target, true);
        }
    };
    Utils.targetDefaultTracks = function () {
        var currentSequence = app.project.activeSequence;
        this.targetAllTracks(false);
        for (var i = 0; i < Math.min(3, currentSequence.videoTracks.numTracks); i++) {
            currentSequence.videoTracks[i].setTargeted(true, true);
        }
        if (currentSequence.audioTracks.numTracks > 0) {
            currentSequence.audioTracks[0].setTargeted(true, true);
        }
    };
    Utils.targetTracks = function (videoTrack, audioTrack) {
        this.targetAllTracks(false);
        var currentSequence = app.project.activeSequence;
        if (currentSequence.videoTracks.numTracks > videoTrack) {
            currentSequence.videoTracks[videoTrack].setTargeted(true, true);
        }
        if (currentSequence.audioTracks.numTracks > audioTrack) {
            currentSequence.audioTracks[audioTrack].setTargeted(true, true);
        }
    };
    Utils.fixPlayHeadPosition = function () {
        var currentSequence = app.project.activeSequence;
        var currentPlayheadPosition = currentSequence.getPlayerPosition().ticks;
        var ticksPerFrame = currentSequence.getSettings().videoFrameRate.ticks;
        var newPos = Math.ceil(parseInt(currentPlayheadPosition) / parseInt(ticksPerFrame));
        currentSequence.setPlayerPosition(String(newPos * parseInt(ticksPerFrame)));
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
    Utils.ticksPerSecond = 254016000000;
    return Utils;
}());
var EffectUtils = /** @class */ (function () {
    function EffectUtils() {
    }
    EffectUtils.applyEffectOnFirstSelectedVideoClip = function (effectName) {
        var clipInfo = Utils.getFirstSelectedClip(true);
        var qeClip = Utils.getQEVideoClip(clipInfo.trackIndex, clipInfo.clipIndex);
        var effect = qe.project.getVideoEffectByName(effectName);
        qeClip.addVideoEffect(effect);
        // For better usability, always return the newest effects (this ones) properties! 
        return clipInfo.clip.components[2].properties;
    };
    EffectUtils.applyDropShadowPreset = function () {
        var shadowEffectProperties = this.applyEffectOnFirstSelectedVideoClip("Schlagschatten");
        var opacity = shadowEffectProperties[1];
        var softness = shadowEffectProperties[4];
        opacity.setValue(255, true);
        softness.setValue(44, true);
    };
    return EffectUtils;
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
    },
    /**
     * @swagger
     * /targetAllTracks:
     *      get:
     *          description: Sets the target of all tracks to activated.
     */
    targetAllTracks: function () {
        Utils.targetAllTracks(true);
    },
    /**
     * @swagger
     * /untargetAllTracks:
     *      get:
     *          description: Sets the target of all tracks to deactivated.
     */
    untargetAllTracks: function () {
        Utils.targetAllTracks(false);
    },
    /**
     * @swagger
     * /applyDropShadowPreset:
     *      get:
     *          description: Applies the custom tweaked drop shadow effect on the first currently selected clip.
     */
    applyDropShadowPreset: function () {
        EffectUtils.applyDropShadowPreset();
    },
    /**
     * @swagger
     * /targetDefaultTracks:
     *      get:
     *          description: Targets the default tracks (video 1-3, audio 1).
     */
    targetDefaultTracks: function () {
        Utils.targetDefaultTracks();
    },
    /**
     * @swagger
     * /targetTracks?videoTrack={videoTrack}&audioTrack={audioTrack}:
     *      get:
     *          description: Untargets all tracks. Then, only targets the specified tracks.
     *          parameters:
     *              - name: videoTrack
     *                description: the single video track to target (starting at 1)
     *                in: path
     *                type: number
     *              - name: audioTrack
     *                description: the single audio track to target (starting at 1)
     *                in: path
     *                type: number
     */
    targetTracks: function (videoTrack, audioTrack) {
        Utils.targetTracks(parseInt(videoTrack) - 1, parseInt(audioTrack) - 1);
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
