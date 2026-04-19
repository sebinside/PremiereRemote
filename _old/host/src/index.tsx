import { MarkerUtils } from "./MarkerUtils";
import { Utils } from "./Utils";
import { EffectUtils } from "./EffectUtils";

/**
 * ALL functions defined here are visible via the localhost REST-like service.
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
  kill: function() {},

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
  addCustomMarker: function(color: string) {
    MarkerUtils.addCustomMarker(color);
  },

  /**
   * @swagger
   * /loadMarkersFromCSVFile:
   *      get:
   *          description: Loads serialized marker information from a CSV file, creates top layer markers for it.
   *                       Note_ To work properly, a marker-bin with 15 setting layers (all 15 colors) is required.
   */
  loadMarkersFromCSVFile: function() {
    MarkerUtils.loadMarkersFromCSVFile();
  },

  /**
   * @swagger
   * /saveCustomMarkerToTextFile:
   *      get:
   *          description: Saves all custom markers (top track settings layers, see above) to a specified file (Open File Dialog).
   */
  saveCustomMarkerToTextFile: function() {
    MarkerUtils.saveCustomMarkerToTextFile();
  },

  /**
   * @swagger
   * /selectCurrentMarker:
   *      get:
   *          description: Selects the current marker at playhead position.
   *                       Short explanation I use the topmost video track with setting layer as markers due to the better support in premiere.
   */
  selectCurrentMarker: function() {
    MarkerUtils.selectCurrentMarker();
  },

  /**
   * @swagger
   * /deselectAll:
   *      get:
   *          description: Deselects all video and audio clips
   */
  deselectAll: function() {
    MarkerUtils.deselectAll();
  },

  /**
   * @swagger
   * /targetAllTracks:
   *      get:
   *          description: Sets the target of all tracks to activated.
   */
  targetAllTracks: function() {
    Utils.targetAllTracks(true);
  },

  /**
   * @swagger
   * /untargetAllTracks:
   *      get:
   *          description: Sets the target of all tracks to deactivated.
   */
  untargetAllTracks: function() {
    Utils.targetAllTracks(false);
  },

  /**
   * @swagger
   * /changeAudioLevels?level={level}:
   *      get:
   *          description: Changes the audio level of all selected audio track items.
   *          parameters:
   *              - name: level
   *                description: level change in dB (levels over +15dB are not supported)
   *                in: path
   *                type: number
   */
  changeAudioLevels: function(level: string) {
    EffectUtils.changeAllAudioLevels(parseInt(level));
  },

  /**
   * @swagger
   * /applyDropShadowPreset:
   *      get:
   *          description: Applies the custom tweaked drop shadow effect on the first currently selected clip.
   */
  applyDropShadowPreset: function() {
    EffectUtils.applyDropShadowPreset();
  },

  /**
   * @swagger
   * /applyBlurPreset:
   *      get:
   *          description: Applies the custom tweaked gaussian blur effect on the first currently selected clip.
   */
  applyBlurPreset: function() {
    EffectUtils.applyBlurPreset();
  },

  /**
   * @swagger
   * /zoomCurrentClipToFit:
   *      get:
   *          description: Sets the scale of the first selected clip to match the sequence size.
   */
  zoomCurrentClipToFit: function() {
    Utils.zoomToFit(Utils.getFirstSelectedClip(true));
  },

  /**
   * @swagger
   * /applyWarpStabilizer:
   *      get:
   *          description: Applies the warp stabilizer effect on the first currently selected clip.
   */
  applyWarpStabilizer: function() {
    EffectUtils.applyWarpStabilizer();
  },

  /**
   * @swagger
   * /zoomInTo120percent:
   *      get:
   *          description: Sets the scale of the current clip to 120 percent.
   */
  zoomInTo120percent: function() {
    Utils.setZoomOfCurrentClip(120);
  },

  /**
   * @swagger
   * /setZoom100:
   *      get:
   *          description: Sets the scale of the current clip to 100 percent.
   */
  setZoom100: function() {
      Utils.setZoomOfCurrentClip(100);
  },

  /**
   * @swagger
   * /zoom?value={value}:
   *      get:
   *          description: Changes the zoom of the current selected clip by the specified value.
   *          parameters:
   *              - name: value
   *                description: value change in percent
   *                in: path
   *                type: number
   */
  zoom: function(value: string) {
    Utils.changeZoom(value);
  },

  /**
   * @swagger
   * /setRotate0:
   *      get:
   *          description: Sets the rotation of the current clip to 0.
   */
  setRotate0: function() {
    Utils.setRotationOfCurrentClip(0);
  },

  /**
   * @swagger
   * /rotate?value={value}:
   *      get:
   *          description: Changes the rotation of the current selected clip by the specified value.
   *          parameters:
   *              - name: value
   *                description: value change in degree (is divided by 2)
   *                in: path
   *                type: number
   */
  rotate: function(value: string) {
    Utils.changeRotation(value);
  },

  /**
   * @swagger
   * /xmove?value={value}:
   *      get:
   *          description: Changes the x position of the current selected clip by the specified value.
   *          parameters:
   *              - name: value
   *                description: value change in pixels (modified by internal modifier)
   *                in: path
   *                type: number
   */
  xmove: function(value: string) {
    Utils.changePosition(value, "0", 5);
  },

  /**
   * @swagger
   * /ymove?value={value}:
   *      get:
   *          description: Changes the y position of the current selected clip by the specified value.
   *          parameters:
   *              - name: value
   *                description: value change in pixels (modified by internal modifier)
   *                in: path
   *                type: number
   */
  ymove: function(value: string) {
    Utils.changePosition("0", value, 5);
  },

  /**
   * @swagger
   * /targetDefaultTracks:
   *      get:
   *          description: Targets the default tracks (video 1-3, audio 1).
   */
  targetDefaultTracks: function() {
    Utils.targetDefaultTracks();
  },

  /**
   * @swagger
   * /setLockedForAllTracks?locked={locked}:
   *      get:
   *          description: Locks or unlocks all tracks.
   *          parameters:
   *              - name: locked
   *                description: true if all tracks shall be locked
   *                in: path
   *                type: boolean
   */
  setLockedForAllTracks: function(locked: string) {
    Utils.setLockedForAllTracks(locked === "true");
  },

  /**
   * @swagger
   * /unlockTracks?videoTrack={videoTrack}&audioTrack={audioTrack}:
   *      get:
   *          description: Unlocks the specified tracks.
   *          parameters:
   *              - name: videoTrack
   *                description: the single video track to unlock (starting at 1)
   *                in: path
   *                type: number
   *              - name: audioTrack
   *                description: the single audio track to unlock (starting at 1)
   *                in: path
   *                type: number
   */
  unlockTracks: function(videoTrack: string, audioTrack: string) {
    Utils.unlockTracks(parseInt(videoTrack) - 1, parseInt(audioTrack) - 1);
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
  targetTracks: function(videoTrack: string, audioTrack: string) {
    Utils.targetTracks(parseInt(videoTrack) - 1, parseInt(audioTrack) - 1);
  }

};

/**
 * These functions are only used internally.
 */
export const framework = {
  enableQualityEngineering: function() {
    app.enableQE();
  }
};
