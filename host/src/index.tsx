/**
 * ALL functions defined here are visible via the localhost service.
 */
export const host = {
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
   * /yourNewFunction?param1={param1}&param2={param2}:
   *      get:
   *          description: Your new function, ready to be called!
   *          parameters:
   *              - name: param1
   *                description: Just a sample parameter
   *                in: path
   *                type: string
   *              - name: param2
   *                description: Just another sample parameter
   *                in: path
   *                type: string
   */
  yourNewFunction: function (param1, param2) {
    alert(param1 + " " + param2);
  },

  zoom: function(value: string) {
    const clipInfo = this.getFirstSelectedClip(true)
    const scaleInfo = clipInfo.clip.components[1].properties[1];
    scaleInfo.setValue(scaleInfo.getValue() + parseInt(value), true);
  },

  setZoom100: function() {
    const clipInfo = this.getFirstSelectedClip(true)
    const scaleInfo = clipInfo.clip.components[1].properties[1];
    scaleInfo.setValue(100.0, true);
  },

  getFirstSelectedClip: function(videoClip: Boolean) {
    const currentSequence = app.project.activeSequence;
    const tracks = videoClip ? currentSequence.videoTracks : currentSequence.audioTracks;
    for (let i = 0; i < tracks.numTracks; i++) {
      for (let j = 0; j < tracks[i].clips.numItems; j++) {
          const currentClip = tracks[i].clips[j];
          if(currentClip.isSelected()) {
            return { clip: currentClip,
              trackIndex: i,
              clipIndex: j
            }
          }
      }
    }
    return null;
  }
};

/**
 * These functions are only used internally.
 */
export const framework = {
  enableQualityEngineering: function () {
    app.enableQE();
  }
};

