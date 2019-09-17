define("test", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.test = "ABC";
});
/// <reference types="types-for-adobe/Premiere/2018"/>
define("index", ["require", "exports", "test"], function (require, exports, test_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    /**
     * ALL functions defined here are visible via the localhost REST-like service.
     */
    exports.host = {
        test: test_1.test,
        /**
         * @swagger
         *
         * /kill:
         *      get:
         *          description: This method is only there for debugging purposes.
         *                       For more information, please have a look at the index.js file.
         */
        kill: function () {
        },
        /**
         * @swagger
         *
         * /muteAudioTrack?trackNumber={trackNumber}:
         *      get:
         *          description: Mutes an audio track of the active sequence.
         *          parameters:
         *              - name: trackNumber
         *                description: the 0 based audio track number
         *                in: path
         *                type: number
         */
        muteAudioTrack: function (trackNumber) {
            trackNumber = parseInt(trackNumber);
            var sequence = app.project.activeSequence;
            if (trackNumber < sequence.audioTracks.numTracks) {
                sequence.audioTracks[trackNumber].setMute();
            }
        },
        /**
         * @swagger
         *
         * /selectSelectedNamedVideoLayer?name={name}:
         *      get:
         *          description: Selects the proper named video clip of all currently selected clips.
         *          parameters:
         *              - name: name
         *                description: the name of the layer, e.g REC_2153.mp4
         *                in: path
         *                type: string
         */
        selectSelectedNamedVideoLayer: function (name) {
            var sequence = app.project.activeSequence;
            // Search all selected video layers
            for (var i = 0; i < sequence.videoTracks.numTracks; i++) {
                var allVideoClips = sequence.videoTracks[i].clips;
                for (var n = 0; n < allVideoClips.numItems; n++) {
                    var videoClip = allVideoClips[n];
                    if (videoClip.isSelected()) {
                        // Maybe, this is the correctly named layer
                        if (videoClip.name === name) {
                            videoClip.setSelected(1, 1);
                        }
                        else {
                            videoClip.setSelected(0, 1);
                        }
                    }
                }
            }
            // Deselect all audio layers
            for (var j = 0; j < sequence.audioTracks.numTracks; j++) {
                var allAudioClips = sequence.audioTracks[j].clips;
                for (var k = 0; k < allAudioClips.numItems; k++) {
                    var audioClip = allAudioClips[k];
                    audioClip.setSelected(0, 1);
                }
            }
        },
        /**
         * @swagger
         * /toggleTrackLock?isVideoTrack={isVideoTrack}&trackNumber={trackNumber}:
         *      get:
         *          description: Toggles the lock of a specified track of the current scene.
         *          parameters:
         *              - name: isVideoTrack
         *                description: true, if the specified track is video
         *                in: path
         *                type: boolean
         *              - name: trackNumber
         *                description: the 0 based track number
         *                in: path
         *                type: number
         */
        toggleTrackLock: function (isVideoTrack, trackNumber) {
            var isLocked = this.isTrackLocked(isVideoTrack, trackNumber);
            this.setTrackLock(isVideoTrack, trackNumber, !isLocked);
        },
        /**
         * @swagger
         * /setTrackLock?isVideoTrack={isVideoTrack}&trackNumber={trackNumber}&setLocked={setLocked}:
         *      get:
         *          description: Locks or unlocks a specified track of the current scene.
         *          parameters:
         *              - name: isVideoTrack
         *                description: true, if the specified track is video
         *                in: path
         *                type: boolean
         *              - name: trackNumber
         *                description: the 0 based track number
         *                in: path
         *                type: number
         *              - name: trackNumber
         *                description: true, if the track should be locked
         *                in: path
         *                type: boolean
         */
        setTrackLock: function (isVideoTrack, trackNumber, setLocked) {
            if (typeof setLocked === "string") {
                setLocked = (setLocked === "true");
            }
            helper.getTrackQE(isVideoTrack, trackNumber).setLock(Boolean(setLocked));
        },
        /**
         * @swagger
         * /isTrackLocked?isVideoTrack={isVideoTrack}&trackNumber={trackNumber}:
         *      get:
         *          description: Returns, if the specified track is currently locked.
         *          parameters:
         *              - name: isVideoTrack
         *                description: true, if the specified track is video
         *                in: path
         *                type: boolean
         *              - name: trackNumber
         *                description: the 0 based track number
         *                in: path
         *                type: number
         */
        isTrackLocked: function (isVideoTrack, trackNumber) {
            return helper.getTrackQE(isVideoTrack, trackNumber).isLocked();
        },
        /**
         * @swagger
         * /toggleMultipleTrackLocks?trackNumbers={trackNumbers}:
         *      get:
         *          description: Toggles the lock-state of multiple audio or video tracks.
         *          parameters:
         *              - name: trackNumbers
         *                description: comma separated list of 0 based track descriptors, e.g. "a0,v0,v1"
         *                in: path
         *                type: string
         */
        toggleMultipleTrackLocks: function (trackNumbers) {
            var descriptors = trackNumbers.split(",");
            for (var i = 0; i < descriptors.length; i++) {
                var descriptor = descriptors[i];
                var isVideoTrack = descriptor.charAt(0) === "v";
                var trackNumber = parseInt(descriptor.charAt(1));
                this.toggleTrackLock(isVideoTrack.toString(), trackNumber.toString());
            }
        },
        /**
         * @swagger
         * /setMultipleTrackLocks?trackNumbers={trackNumbers}&setLocked={setLocked}:
         *      get:
         *          description: Sets the lock-state of multiple audio or video tracks.
         *          parameters:
         *              - name: trackNumbers
         *                description: comma separated list of 0 based track descriptors, e.g. "a0,v0,v1"
         *                in: path
         *                type: string
         *              - name: setLocked
         *                description: true, if the tracks should be locked
         *                in: path
         *                type: boolean
         */
        setMultipleTrackLocks: function (trackNumbers, setLocked) {
            var descriptors = trackNumbers.split(",");
            for (var i = 0; i < descriptors.length; i++) {
                var descriptor = descriptors[i];
                var isVideoTrack = descriptor.charAt(0) === "v";
                var trackNumber = parseInt(descriptor.charAt(1));
                this.setTrackLock(isVideoTrack.toString(), trackNumber.toString(), setLocked);
            }
        },
        /**
         * @swagger
         * /selectCurrentMarker:
         *      get:
         *          description: Selects the current marker at playhead position.
         *                       Short explanation I use the topmost video track with setting layer as markers due to the better support in premiere.
         */
        selectCurrentMarker: function () {
            this.deselectAllMarkers();
            var clip = helper.getCurrentMarkerClip();
            if (clip !== undefined) {
                clip.setSelected(1);
            }
        },
        /**
         * @swagger
         * /deselectAllMarkers:
         *      get:
         *          description: Deselects all markers in the marker layer.
         */
        deselectAllMarkers: function () {
            var currentSequence = app.project.activeSequence;
            var markerLayer = currentSequence.videoTracks[currentSequence.videoTracks.numTracks - 1];
            var markerClips = markerLayer.clips;
            var markerCount = markerClips.numItems;
            for (var i = 0; i < markerCount; i++) {
                var clip = markerClips[i];
                clip.setSelected(0);
            }
        },
        /**
         * @swagger
         * /setCurrentMarkerName?name={name}:
         *      get:
         *          description: Sets the name of the current marker. Not a real marker, rather a settings layer, see above.
         *          parameters:
         *              - name: name
         *                description: The name to be set for the current marker
         *                in: path
         *                type: string
         */
        setCurrentMarkerName: function (name) {
            var clip = helper.getCurrentMarkerClip();
            if (clip !== undefined) {
                clip.name = name;
            }
        },
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
            var currentSequence = app.project.activeSequence;
            var markerLayer = currentSequence.videoTracks[currentSequence.videoTracks.numTracks - 1];
            helper.fixPlayHeadPosition(helper.projectFrameRate);
            var currentPlayheadPosition = currentSequence.getPlayerPosition();
            var markerChild = helper.getMarkerItemInMarkerFolder(color);
            if (markerChild === undefined) {
                alert("No 'marker' folder found. Please use a viable preset.");
            }
            else {
                markerLayer.overwriteClip(markerChild, currentPlayheadPosition);
            }
        },
        /**
         * @swagger
         * /toggleLockCustomMarkerTrack:
         *      get:
         *          description: Toggles the lock of the "marker layer", the top most video track.
         */
        toggleLockCustomMarkerTrack: function () {
            var currentSequence = app.project.activeSequence;
            var markerTrackNumber = currentSequence.videoTracks.numTracks - 1;
            this.toggleTrackLock("true", markerTrackNumber.toString());
        },
        /**
         * @swagger
         * /saveCustomMarkers:
         *      get:
         *          description: Saves all custom markers (top track settings layers, see above) to a specified file (Open File Dialog).
         */
        saveCustomMarkers: function () {
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
                var trueSeconds = clip.start.seconds;
                var hours = trueSeconds / 3600;
                trueSeconds -= hours * 3600;
                var minutes = trueSeconds / 60;
                trueSeconds -= minutes * 60;
                var seconds = trueSeconds;
                if (hours > 0) {
                    output += helper.pad(hours, 2) + ":";
                }
                output += helper.pad(minutes, 2) + ":";
                output += helper.pad(seconds, 2) + " - ";
                output += clip.name + "\n";
            }
            var file = new File();
            var fileNew = file.saveDlg("Save new file", "*.txt");
            fileNew.open("w");
            fileNew.write(output);
            fileNew.close();
        },
        /**
         * @swagger
         * /insertNamedRootItemIntoTrack?trackNumber={trackNumber}&itemName={itemName}&deltaInTicks={deltaInTicks}&isVideoTrack={isVideoTrack}:
         *      get:
         *          description: Inserts a name project item (from root folder) into an audio/video track, with an optional delta.
         *          parameters:
         *              - name: trackNumber
         *                description: the zero-based track number
         *                in: path
         *                type: number
         *              - name: itemName
         *                description: the name of the item, e.g. "my_first_video.mp4"
         *                in: path
         *                type: string
         *              - name: deltaInTicks
         *                description: the delta in ticks to move from the playhead position. Default 0
         *                in: path
         *                type: number
         *              - name: isVideoTrack
         *                description: true, if the clip should be inserted in a video track, false if audio track
         *                in: path
         *                type: boolean
         */
        insertNamedRootItemIntoTrack: function (trackNumber, itemName, deltaInTicks, isVideoTrack) {
            var activeSequence = app.project.activeSequence;
            // Get player position and add delta
            var currentPlayheadPosition = activeSequence.getPlayerPosition();
            currentPlayheadPosition.ticks = (parseInt(currentPlayheadPosition.ticks) + parseInt(deltaInTicks)).toString();
            var targetTrack;
            if (isVideoTrack === "true") {
                if (parseInt(trackNumber) < activeSequence.videoTracks.numTracks) {
                    targetTrack = activeSequence.videoTracks[parseInt(trackNumber)];
                }
                else {
                    alert("Bad video track number.");
                }
            }
            else {
                if (parseInt(trackNumber) < activeSequence.audioTracks.numTracks) {
                    targetTrack = activeSequence.audioTracks[parseInt(trackNumber)];
                }
                else {
                    alert("Bad audio track number.");
                }
            }
            var projectItem = helper.getProjectItemInRoot(itemName);
            if (projectItem === undefined) {
                alert("Specified item with name '" + projectItem + "' not found in project root.");
            }
            else {
                targetTrack.overwriteClip(projectItem, currentPlayheadPosition);
            }
        },
        /**
         * @swagger
         * /loadMarkersFromCSVFile:
         *      get:
         *          description: Loads serialized marker information from a CSV file, creates top layer markers for it.
         *                       Note_ To work properly, a marker-bin with 15 setting layers (all 15 colors) is required.
         */
        loadMarkersFromCSVFile: function () {
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
                        var seconds = parseInt(entry[0]) * 3600 + parseInt(entry[1]) * 60 + parseInt(entry[2]) + (parseInt(entry[3]) / 1000);
                        var mode = entry[4];
                        var message = entry[5];
                        var color = entry[6];
                        // Insert clip
                        var markerChild = helper.getMarkerItemInMarkerFolder(color);
                        var targetInSeconds = currentPlayheadPosition.seconds + seconds;
                        markerLayer.overwriteClip(markerChild, targetInSeconds);
                        // Retrieve clip
                        var clip = helper.getLastUnnamedMarkerClip();
                        // Set name
                        clip.name = message;
                        // Set length
                        if (mode === "mode") {
                            // If mode == mode, get next item with mode mode and calculate length
                            var nextItemSeconds = -1;
                            for (var j = i + 1; j < lines.length; j++) {
                                var newEntry = lines[j].split(",");
                                var nextSeconds = parseInt(newEntry[0]) * 3600 + parseInt(newEntry[1]) * 60 + parseInt(newEntry[2]) + (parseInt(newEntry[3]) / 1000);
                                var nextMode = newEntry[4];
                                if (nextMode === "mode") {
                                    nextItemSeconds = nextSeconds;
                                    break;
                                }
                            }
                            if (nextItemSeconds > 0) {
                                var endTime = new Time;
                                endTime.seconds = nextItemSeconds + currentPlayheadPosition.seconds;
                                // @ts-ignore
                                clip.end = endTime;
                            }
                        }
                    }
                }
            }
        }
    };
    /**
     *
     * Define your helping functions here, these are NOT published on localhost.
     */
    var helper = {
        projectFrameRate: 24,
        /**
         * Returns the specified track using the QE DOM.
         * @param isVideoTrack true, if the specified track is video
         * @param trackNumber the 0 based track number
         * @returns a track object
         */
        getTrackQE: function (isVideoTrack, trackNumber) {
            var activeSequence = qe.project.getActiveSequence();
            var track;
            if (isVideoTrack === "true") {
                track = activeSequence.getVideoTrackAt(parseInt(trackNumber));
            }
            else {
                track = activeSequence.getAudioTrackAt(parseInt(trackNumber));
            }
            return track;
        },
        fixPlayHeadPosition: function (frameRate) {
            var currentSequence = app.project.activeSequence;
            var currentPlayheadPosition = currentSequence.getPlayerPosition().ticks;
            var ticksPerSecond = 254016000000;
            var ticksPerFrame = ticksPerSecond / parseInt(frameRate);
            var newPos = Math.ceil(parseInt(currentPlayheadPosition) / ticksPerFrame);
            currentSequence.setPlayerPosition(String(newPos * ticksPerFrame));
        },
        getCurrentMarkerClip: function () {
            var currentSequence = app.project.activeSequence;
            var markerLayer = currentSequence.videoTracks[currentSequence.videoTracks.numTracks - 1];
            var markerClips = markerLayer.clips;
            var markerCount = markerClips.numItems;
            helper.fixPlayHeadPosition(helper.projectFrameRate);
            var currentPlayheadPosition = currentSequence.getPlayerPosition().ticks;
            for (var i = 0; i < markerCount; i++) {
                var clip = markerClips[i];
                var startTicks = clip.start.ticks;
                var endTicks = clip.end.ticks;
                if (parseInt(startTicks) <= parseInt(currentPlayheadPosition)
                    && parseInt(currentPlayheadPosition) < parseInt(endTicks)) {
                    return clip;
                }
            }
        },
        pad: function (num, size) {
            var s = num + "";
            while (s.length < size)
                s = "0" + s;
            return s;
        },
        getProjectItemInRoot: function (itemName) {
            var projectItem = undefined;
            for (var i = 0; i < app.project.rootItem.children.numItems; i++) {
                var child = app.project.rootItem.children[i];
                if (child.name === itemName) {
                    projectItem = child;
                    break;
                }
            }
            return projectItem;
        },
        getMarkerItemInMarkerFolder: function (markerColor) {
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
        },
        getMarkerClip: function (timestamp) {
            var currentSequence = app.project.activeSequence;
            var markerLayer = currentSequence.videoTracks[currentSequence.videoTracks.numTracks - 1];
            var markerClips = markerLayer.clips;
            var markerCount = markerClips.numItems;
            var timestampInTicks = (timestamp + 1) * 254016000000;
            // Hack to get rid of rounding problems, converted to ticks
            // FIXME: More than one marker per second not supported
            for (var i = 0; i < markerCount; i++) {
                var clip = markerClips[i];
                var startTicks = clip.start.ticks;
                var endTicks = clip.end.ticks;
                if (parseInt(startTicks) <= timestampInTicks
                    && timestampInTicks < parseInt(endTicks)) {
                    return clip;
                }
            }
        },
        getLastUnnamedMarkerClip: function () {
            var currentSequence = app.project.activeSequence;
            var markerLayer = currentSequence.videoTracks[currentSequence.videoTracks.numTracks - 1];
            var markerClips = markerLayer.clips;
            var markerCount = markerClips.numItems;
            var lastMarker = markerClips[markerCount - 1];
            debugger;
            // Dirty coded dirty hack, premiere is... not exact with its ticks?!
            // If last marker has no name = This is my new marker. If it has a name -> streatched mode marker
            if (lastMarker.name === "0" || lastMarker.name === "1" || lastMarker.name === "2" ||
                lastMarker.name === "3" || lastMarker.name === "4" || lastMarker.name === "5" ||
                lastMarker.name === "6" || lastMarker.name === "7" || lastMarker.name === "8" ||
                lastMarker.name === "9" || lastMarker.name === "10" || lastMarker.name === "11" ||
                lastMarker.name === "12" || lastMarker.name === "13" || lastMarker.name === "14" ||
                lastMarker.name === "15") {
                return lastMarker;
            }
            return markerClips[markerCount - 2];
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
});
