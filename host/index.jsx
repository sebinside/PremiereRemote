/**
 * ALL functions defined here are visible via the localhost REST-like service.
 */
var host = {
    /**
     * This method is only there for debugging purposes.
     */
    kill: function () {
    },
    /**
     * Mutes an audio track of the active sequence.
     * @param trackNumber the 0 based audio track number
     */
    muteAudioTrack: function (trackNumber) { // 0 based
        trackNumber = parseInt(trackNumber);

        var sequence = app.project.activeSequence;

        if (trackNumber < sequence.audioTracks.numTracks) {
            sequence.audioTracks[trackNumber].setMute();
        }
    },
    /**
     * Selects the proper named video clip of all currently selected clips.
     * @param name the name of the layer, e.g REC_2153.mp4
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
                        videoClip.setSelected(true, true);
                    } else {
                        videoClip.setSelected(false, true);
                    }
                }
            }
        }
        // Deselect all audio layers
        for (var j = 0; j < sequence.audioTracks.numTracks; j++) {
            var allAudioClips = sequence.audioTracks[j].clips;
            for (var k = 0; k < allAudioClips.numItems; k++) {

                var audioClip = allAudioClips[k];
                audioClip.setSelected(false, true);
            }
        }
    },
    /**
     * Toggles the lock of a specified track of the current scene.
     * @param isVideoTrack true, if the specified track is video
     * @param trackNumber the 0 based track number
     */
    toggleTrackLock: function (isVideoTrack, trackNumber) {
        var isLocked = this.isTrackLocked(isVideoTrack, trackNumber);
        this.setTrackLock(isVideoTrack, trackNumber, !isLocked);
    },
    /**
     * Locks or unlocks a specified track of the current scene.
     * @param isVideoTrack true, if the specified track is video
     * @param trackNumber the 0 based track number
     * @param setLocked true, if the track should be locked
     */
    setTrackLock: function (isVideoTrack, trackNumber, setLocked) {
        if (typeof setLocked === "string") {
            setLocked = (setLocked === "true");
        }

        helper.getTrackQE(isVideoTrack, trackNumber).setLock(Boolean(setLocked));
    },
    /**
     * Returns, if the specified track is currently locked.
     * @param isVideoTrack true, if the specified track is video
     * @param trackNumber the 0 based track number
     * @returns true, if the track is locked
     */
    isTrackLocked: function (isVideoTrack, trackNumber) {
        return helper.getTrackQE(isVideoTrack, trackNumber).isLocked();
    },
    /**
     * Toggles the lock-state of multiple audio or video tracks.
     * @param trackNumbers comma separated list of 0 based track descriptors, e.g. "a0,v0,v1"
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
     * Sets the lock-state of multiple audio or video tracks.
     * @param trackNumbers comma separated list of 0 based track descriptors, e.g. "a0,v0,v1"
     * @param setLocked true, if the tracks should be locked
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
     * Selects the current marker at playhead position.
     * Short explanation: I use the topmost video track with setting layer as markers due to the better support in premiere.
     */
    selectCurrentMarker: function () {
        var clip = helper.getCurrentMarkerClip();

        if (clip !== undefined) {
            clip.setSelected(true);
        }
    },
    /**
     * Sets the name of the current marker. Not a real marker, rather a settings layer, see above.
     * @param name The name lol
     */
    setCurrentMarkerName: function (name) {
        var clip = helper.getCurrentMarkerClip();

        if (clip !== undefined) {
            clip.name = name;
        }
    },
    /**
     * Adds a new marker (NO normal marker, a settings layer, see above) to the current playhead position.
     */
    addCustomMarker: function () {
        var currentSequence = app.project.activeSequence;
        var markerLayer = currentSequence.videoTracks[currentSequence.videoTracks.numTracks - 1];
        var currentPlayheadPosition = currentSequence.getPlayerPosition();

        var markerChild = helper.getProjectItemInRoot("MARKER");

        if (markerChild === undefined) {
            alert("No settings layer called 'MARKER' found!");
        } else {
            markerLayer.overwriteClip(markerChild, currentPlayheadPosition);
        }
    },
    /**
     * Toggles the lock of the "marker layer", the top most video track (See above).
     */
    toggleLockCustomMarkerTrack: function () {
        var currentSequence = app.project.activeSequence;
        var markerTrackNumber = currentSequence.videoTracks.numTracks - 1;
        this.toggleTrackLock("true", markerTrackNumber.toString());
    },
    /**
     * Saves all custom markers (top track settings layers, see above) to a specified file.
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
            var trueSeconds = parseInt(clip.start.seconds);

            var hours = parseInt(trueSeconds / 3600);
            trueSeconds -= hours * 3600;

            var minutes = parseInt(trueSeconds / 60);
            trueSeconds -= minutes * 60;

            var seconds = trueSeconds;

            if (hours > 0) {
                output += pad(hours, 2) + ":";
            }
            output += pad(minutes, 2) + ":";
            output += pad(seconds, 2) + " - ";

            output += clip.name + "\n";

        }

        var file = new File();
        var fileNew = file.saveDlg("Save new file", "*.txt");
        fileNew.open("w");
        fileNew.write(output);
        fileNew.close();
    },
    /**
     * Inserts a name project item (from root folder) into an audio/video track, with an optional delta.
     * @param trackNumber the zero-based track number
     * @param itemName the name of the item, e.g. "my_first_video.mp4"
     * @param deltaInTicks the delta in ticks to move from the playhead position. Default: 0
     * @param isVideoTrack true, if the clip should be inserted in a video track, false if audio track
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
            } else {
                alert("Bad video track number.");
            }
        } else {
            if (parseInt(trackNumber) < activeSequence.audioTracks.numTracks) {
                targetTrack = activeSequence.audioTracks[parseInt(trackNumber)];
            } else {
                alert("Bad audio track number.");
            }
        }

        var projectItem = helper.getProjectItemInRoot(itemName);

        if (projectItem === undefined) {
            alert("Specified item with name '" + projectItem + "' not found in project root.");
        } else {
            targetTrack.overwriteClip(projectItem, currentPlayheadPosition);
        }
    },

    /**
     * Loads serialized marker information from a CSV file, creates top layer markers for it.
     * Note: To work properly, a marker-bin with 15 setting layers (all 15 colors) is required.
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
                    var clip = helper.getMarkerClip(targetInSeconds);

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
                            clip.end = endTime;
                        }
                    }
                }
            }
        }
    }
};

/**
 * Define your helping functions here, these are NOT published on localhost.
 */
var helper = {
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
        } else {
            track = activeSequence.getAudioTrackAt(parseInt(trackNumber));
        }
        return track;
    },
    getCurrentMarkerClip: function () {
        var currentSequence = app.project.activeSequence;
        var markerLayer = currentSequence.videoTracks[currentSequence.videoTracks.numTracks - 1];
        var markerClips = markerLayer.clips;
        var markerCount = markerClips.numItems;
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
        while (s.length < size) s = "0" + s;
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
        var projectItem = undefined;

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

            if (parseInt(startTicks) <= parseInt(timestampInTicks)
                && parseInt(timestampInTicks) < parseInt(endTicks)) {
                return clip;
            }
        }
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