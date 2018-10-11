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
     * Locks a video track of the current sequence.
     * @param number the 0 based video track number
     */
    lockVideoTrack: function (number) {
        var activeSequence = qe.project.getActiveSequence();
        var someTrack = activeSequence.getVideoTrackAt(parseInt(number));
        someTrack.setLock(true);
    }
};

/**
 * Define your helping functions here, these are NOT published on localhost.
 */
var helper = {};

/**
 * These functions are only used internally.
 */
var framework = {
    enableQualityEngineering: function () {
        app.enableQE();
    }
};