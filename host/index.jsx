var host = {
    kill: function () {
        // This method is only there for debugging purposes.
    },
    muteAudioTrack: function (trackNumber) { // 0 based
        trackNumber = parseInt(trackNumber);

        const sequence = app.project.activeSequence;

        if (trackNumber < sequence.audioTracks.numTracks) {
            sequence.audioTracks[trackNumber].setMute();
        }
    },
    selectSelectedNamedVideoLayer: function (name) {

        const sequence = app.project.activeSequence;

        if (sequence) {

            // Search all selected video layers
            for (let i = 0; i < sequence.videoTracks.numTracks; i++) {

                const allVideoClips = sequence.videoTracks[i].clips;
                for (let n = 0; n < allVideoClips.numItems; n++) {

                    const clip = allVideoClips[n];

                    if (clip.isSelected()) {

                        // Maybe, this is the correctly named layer
                        if (clip.name === name) {
                            clip.setSelected(true, true);
                        } else {
                            clip.setSelected(false, true);
                        }
                    }
                }
            }

            // Deselect all audio layers
            for (let i = 0; i < sequence.audioTracks.numTracks; i++) {

                const allAudioClips = sequence.audioTracks[i].clips;

                for (let n = 0; n < allAudioClips.numItems; n++) {

                    const clip = allAudioClips[n];
                    clip.setSelected(false, true);

                }
            }
        }
    }

};