/// <reference path="../typings/JavaScript.d.ts"/>
/// <reference path="../typings/PlugPlugExternalObject.d.ts"/>
/// <reference path="../typings/PremierePro.14.0.d.ts"/>
/// <reference path="../typings/XMPScript.d.ts"/>
/// <reference path="../typings/extendscript.d.ts"/>
/// <reference path="../typings/global.d.ts"/>

declare interface Track {
  overwriteClip(clipProjectItem: ProjectItem, time: Time): void;
}

class MarkerUtils {

  static getMarkerItemInMarkerFolder(
    markerColor: string
  ): undefined | ProjectItem {
    for (let i = 0; i < app.project.rootItem.children.numItems; i++) {
      const child = app.project.rootItem.children[i];

      if (child.name === "marker") {
        for (let j = 0; j < child.children.numItems; j++) {
          const markerChild = child.children[j];

          if (markerChild.name === markerColor) {
            return markerChild;
          }
        }
      }
    }
    return undefined;
  }

  static getLastUnnamedMarkerClip(): TrackItem {
    const currentSequence = app.project.activeSequence;
    const markerLayer =
      currentSequence.videoTracks[currentSequence.videoTracks.numTracks - 1];
    const markerClips = markerLayer.clips;
    const markerCount = markerClips.numItems;

    const lastMarker = markerClips[markerCount - 1];
    debugger;

    if (/[0-9]+/.test(lastMarker.name)) {
      return lastMarker;
    }
    return markerClips[markerCount - 2];
  }

  static addCustomMarker(color: string): void {
    const currentSequence = app.project.activeSequence;
    const markerLayer =
      currentSequence.videoTracks[currentSequence.videoTracks.numTracks - 1];

    Utils.fixPlayHeadPosition();
    const currentPlayheadPosition = currentSequence.getPlayerPosition();

    const markerChild = MarkerUtils.getMarkerItemInMarkerFolder(color);

    if (markerChild === undefined) {
      alert("No 'marker' folder found. Please use a viable preset.");
    } else {
      markerLayer.overwriteClip(markerChild, currentPlayheadPosition);
    }
  }

  static loadMarkersFromCSVFile(): void {
    const csvFileDialog = File.openDialog("Target CSV File", "*.csv");
    const csvFile = csvFileDialog.fsName;

    const currentSequence = app.project.activeSequence;
    const markerLayer =
      currentSequence.videoTracks[currentSequence.videoTracks.numTracks - 1];
    const currentPlayheadPosition = currentSequence.getPlayerPosition();

    if (csvFile) {
      const file = File(csvFile);
      file.open("r");
      const fullText = file.read();
      file.close();

      const lines = fullText.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const entry = lines[i].split(",");

        if (entry.length === 7) {
          // Parse csv
          const seconds =
            parseInt(entry[0]) * 3600 +
            parseInt(entry[1]) * 60 +
            parseInt(entry[2]) +
            parseInt(entry[3]) / 1000;
          const mode = entry[4];
          const message = entry[5];
          const color = entry[6];

          // Insert clip
          const markerChild = MarkerUtils.getMarkerItemInMarkerFolder(color);
          const targetInSeconds = currentPlayheadPosition.seconds + seconds;
          markerLayer.overwriteClip(markerChild, targetInSeconds);

          // Retrieve clip
          const clip = MarkerUtils.getLastUnnamedMarkerClip();

          // Set name
          clip.name = message;

          // Set length
          if (mode === "mode") {
            // If mode == mode, get next item with mode mode and calculate length
            let nextItemSeconds = -1;
            for (let j = i + 1; j < lines.length; j++) {
              const newEntry = lines[j].split(",");
              const nextSeconds =
                parseInt(newEntry[0]) * 3600 +
                parseInt(newEntry[1]) * 60 +
                parseInt(newEntry[2]) +
                parseInt(newEntry[3]) / 1000;
              const nextMode = newEntry[4];

              if (nextMode === "mode") {
                nextItemSeconds = nextSeconds;
                break;
              }
            }
            if (nextItemSeconds > 0) {
              const endTime = new Time();
              endTime.seconds =
                nextItemSeconds + currentPlayheadPosition.seconds;
              clip.end = endTime; // not my fault, types problem
            }
          }
        }
      }
    }
  }

  static saveCustomMarkerToTextFile(): void {
    const currentSequence = app.project.activeSequence;
    const markerLayer =
      currentSequence.videoTracks[currentSequence.videoTracks.numTracks - 1];
    const markerClips = markerLayer.clips;
    const markerCount = markerClips.numItems;
    const projectName = app.project.name;

    let output = "Project: " + projectName + "\n";
    output += "Sequence: " + currentSequence.name + "\n";
    output += "Marker count: " + markerCount + "\n\n";

    for (let i = 0; i < markerCount; i++) {
      const clip = markerClips[i];
      let trueSeconds = parseInt("" + clip.start.seconds);

      const hours = parseInt("" + trueSeconds / 3600);
      trueSeconds -= hours * 3600;

      const minutes = parseInt("" + trueSeconds / 60);
      trueSeconds -= minutes * 60;

      const seconds = trueSeconds;

      if (hours > 0) {
        output += Utils.pad(hours, 2) + ":";
      }
      output += Utils.pad(minutes, 2) + ":";
      output += Utils.pad(seconds, 2) + " - ";

      output += clip.name + "\n";
    }
    try {
      const file = new File();
      const fileNew = file.saveDlg("Save new file", "*.txt");
      fileNew.encoding = "UTF8";
      fileNew.open("w");
      fileNew.write(output);
      fileNew.close();
    } catch (error) {
      // User hit cancel
    }
  }

  static selectCurrentMarker(): void {
    const clip = MarkerUtils.getCurrentMarkerClip();

    if (clip !== undefined) {
      clip.setSelected(true, true);
    }
  }

  static getCurrentMarkerClip(): TrackItem {
    const currentSequence = app.project.activeSequence;
    const markerLayer =
      currentSequence.videoTracks[currentSequence.videoTracks.numTracks - 1];
    const markerClips = markerLayer.clips;
    const markerCount = markerClips.numItems;

    Utils.fixPlayHeadPosition();
    const currentPlayheadPosition = currentSequence.getPlayerPosition().ticks;

    for (let i = 0; i < markerCount; i++) {
      const clip = markerClips[i];
      const startTicks = clip.start.ticks;
      const endTicks = clip.end.ticks;

      if (
        parseInt(startTicks) <= parseInt(currentPlayheadPosition) &&
        parseInt(currentPlayheadPosition) < parseInt(endTicks)
      ) {
        return clip;
      } 
    }
  }
  static deselectAll(): void {
    const currentSequence = app.project.activeSequence;
    for (let i = 0; i < currentSequence.videoTracks.numTracks; i++) {
      const track = currentSequence.videoTracks[i];
      for (let j = 0; j < track.clips.numItems; j++) {
        const clip = track.clips[j];
        clip.setSelected(false, true);
      }
    }
    for (let i = 0; i < currentSequence.audioTracks.numTracks; i++) {
      const track = currentSequence.videoTracks[i];
      for (let j = 0; j < track.clips.numItems; j++) {
        const clip = track.clips[j];
        clip.setSelected(false, true);
      }
    }
  }
}

class Utils {
  static ticksPerSecond = 254016000000;

  static getFirstSelectedClip(videoClip: Boolean) {
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

  static getVideoClip(trackIndex: number, clipIndex: number) {
    const currentSequence = app.project.activeSequence;
    return currentSequence.videoTracks[trackIndex].clips[clipIndex];
  }

  static zoomToFit(videoClip) {
    if(videoClip != null) {
      const clipSize = this.getClipSize(videoClip.clip);
      const frameHeight = app.project.activeSequence.frameSizeVertical;
      const frameWidth = app.project.activeSequence.frameSizeHorizontal;

      const verticalFactor = frameHeight / clipSize.height;
      const horizontalFactor = frameWidth / clipSize.width;
      
      const zoomLevel = Math.max(verticalFactor, horizontalFactor) * 100;

      EffectUtils.setZoomOfCurrentClip(zoomLevel);
    }
  }

  static getClipSize(videoClip: TrackItem) {
    const projectItem = videoClip.projectItem;
    const videoInfo = Utils.getProjectMetadata(projectItem, 
      ["Column.Intrinsic.VideoInfo"])[0][0].toString();

    const width = parseInt(videoInfo.split(' ')[0]);
    const height = parseInt(videoInfo.split(' ')[2]);
    return {"height": height, "width": width}
  }

  static getQEVideoClipByStart(trackIndex : number, startInTicks : string) {
    const currentSequence = qe.project.getActiveSequence();
    const videoTrack = currentSequence.getVideoTrackAt(trackIndex);

    for(let i = 0; i < videoTrack.numItems; i++) {
      const clip = videoTrack.getItemAt(i);

      if(clip.start.ticks === startInTicks) {
        return clip;
      }

    }
  }

  static targetAllTracks(target: boolean) {
    const currentSequence = app.project.activeSequence;
    for(let i = 0; i < currentSequence.videoTracks.numTracks; i++) {
      currentSequence.videoTracks[i].setTargeted(target, true)
    }
    for(let i = 0; i < currentSequence.audioTracks.numTracks; i++) {
      currentSequence.audioTracks[i].setTargeted(target, true)
    }
  }

  static targetDefaultTracks() { 
    const currentSequence = app.project.activeSequence;
    this.targetAllTracks(false);
    for (let i = 0; i < Math.min(3, currentSequence.videoTracks.numTracks); i++) {
      currentSequence.videoTracks[i].setTargeted(true, true);
    }
    if(currentSequence.audioTracks.numTracks > 0) {
      currentSequence.audioTracks[0].setTargeted(true, true);
    }
  }

  static targetTracks(videoTrack: number, audioTrack: number) {
    this.targetAllTracks(false);

    const currentSequence = app.project.activeSequence;
    
    if(currentSequence.videoTracks.numTracks > videoTrack) {
      currentSequence.videoTracks[videoTrack].setTargeted(true, true);
    }
    if(currentSequence.audioTracks.numTracks > audioTrack) {
      currentSequence.audioTracks[audioTrack].setTargeted(true, true);
    }
  }

  static fixPlayHeadPosition(): void {
    const currentSequence = app.project.activeSequence;
    const currentPlayheadPosition = currentSequence.getPlayerPosition().ticks;
    const ticksPerFrame = currentSequence.getSettings().videoFrameRate.ticks;
    const newPos = Math.ceil(parseInt(currentPlayheadPosition) / parseInt(ticksPerFrame));

    currentSequence.setPlayerPosition(String(newPos * parseInt(ticksPerFrame)));
  }

  static pad(num: number, size: number): string {
    let s = num.toString();
    while (s.length < size) s = "0" + s;
    return s;
  }

  static getProjectItemInRoot(itemName: string): ProjectItem {
    let projectItem = undefined;

    for (let i = 0; i < app.project.rootItem.children.numItems; i++) {
      const child = app.project.rootItem.children[i];
      if (child.name === itemName) {
        projectItem = child;
        break;
      }
    }

    return projectItem;
  }

  static getProjectMetadata(projectItem: ProjectItem, fieldNames) {
    // Based on: https://community.adobe.com/t5/premiere-pro/get-image-size-in-jsx/td-p/10554914?page=1&profile.language=de
    const kPProPrivateProjectMetadataURI ="http://ns.adobe.com/premierePrivateProjectMetaData/1.0/";
    if (app.isDocumentOpen()) {
        if (projectItem) {

            if (ExternalObject.AdobeXMPScript === undefined)
                ExternalObject.AdobeXMPScript = new ExternalObject("lib:AdobeXMPScript");
            if (ExternalObject.AdobeXMPScript !== undefined) {
                let retArray = [];
                let retArray2 = [];
                const projectMetadata = projectItem.getProjectMetadata();
                let xmp = new XMPMeta(projectMetadata);
                for (let pc = 0; pc < fieldNames.length; pc++) {
                    if (xmp.doesPropertyExist(kPProPrivateProjectMetadataURI, fieldNames[pc])) {
                        retArray.push([fieldNames[pc],xmp.getProperty(kPProPrivateProjectMetadataURI, fieldNames[pc])]);
                        retArray2.push([xmp.getProperty(kPProPrivateProjectMetadataURI,fieldNames[pc])]);
                    }
                }
                return retArray2;
            }
        }
    }
    return false;
  }
}

class EffectUtils {

  static setZoomOfCurrentClip(zoomLevel: number) {
    const clipInfo = Utils.getFirstSelectedClip(true)
    const scaleInfo = clipInfo.clip.components[1].properties[1];
    scaleInfo.setValue(zoomLevel, true);
  }

  static applyEffectOnFirstSelectedVideoClip(effectName: String) {
    const clipInfo = Utils.getFirstSelectedClip(true)
    const qeClip = Utils.getQEVideoClipByStart(clipInfo.trackIndex, clipInfo.clip.start.ticks)
    var effect = qe.project.getVideoEffectByName(effectName);
    qeClip.addVideoEffect(effect);

    // For better usability, always return the newest effects (this ones) properties! 
    return clipInfo.clip.components[2].properties;
  }

  static applyDropShadowPreset() { 
    const shadowEffectProperties = this.applyEffectOnFirstSelectedVideoClip("Schlagschatten");
    const opacity = shadowEffectProperties[1];
    const softness = shadowEffectProperties[4];

    opacity.setValue(255, true);
    softness.setValue(44, true);
  }

  static applyBlurPreset() {
    const blurEffectProperties = this.applyEffectOnFirstSelectedVideoClip("Gaußscher Weichzeichner");

    const blurriness = blurEffectProperties[0];
    const repeatBorderPixels = blurEffectProperties[2];

    blurriness.setValue(42, true);
    repeatBorderPixels.setValue(true, true);
  }

  static applyWarpStabilizer() {
    this.applyEffectOnFirstSelectedVideoClip("Verkrümmungsstabilisierung");
  }

}

/**
 * ALL functions defined here are visible via the localhost REST-like service.
 */
const host = {
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
    EffectUtils.setZoomOfCurrentClip(120);
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
const framework = {
  enableQualityEngineering: function() {
    app.enableQE();
  }
};
