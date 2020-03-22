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
  static addCustomMarker(color: string): void {
    const currentSequence = app.project.activeSequence;
    const markerLayer =
      currentSequence.videoTracks[currentSequence.videoTracks.numTracks - 1];

    Utils.fixPlayHeadPosition(Utils.projectFrameRate);
    const currentPlayheadPosition = currentSequence.getPlayerPosition();

    const markerChild = Utils.getMarkerItemInMarkerFolder(color);

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
          const markerChild = Utils.getMarkerItemInMarkerFolder(color);
          const targetInSeconds = currentPlayheadPosition.seconds + seconds;
          markerLayer.overwriteClip(markerChild, targetInSeconds);

          // Retrieve clip
          const clip = Utils.getLastUnnamedMarkerClip();

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
      clip.setSelected(true);
    }
  }

  static getCurrentMarkerClip(): TrackItem {
    const currentSequence = app.project.activeSequence;
    const markerLayer =
      currentSequence.videoTracks[currentSequence.videoTracks.numTracks - 1];
    const markerClips = markerLayer.clips;
    const markerCount = markerClips.numItems;

    Utils.fixPlayHeadPosition(Utils.projectFrameRate);
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
        clip.setSelected(false);
      }
    }
    for (let i = 0; i < currentSequence.audioTracks.numTracks; i++) {
      const track = currentSequence.videoTracks[i];
      for (let j = 0; j < track.clips.numItems; j++) {
        const clip = track.clips[j];
        clip.setSelected(false);
      }
    }
  }
}

class Utils {
  static projectFrameRate = 24;

  static fixPlayHeadPosition(frameRate: number): void {
    const currentSequence = app.project.activeSequence;
    const currentPlayheadPosition = currentSequence.getPlayerPosition().ticks;
    const ticksPerSecond = 254016000000;
    const ticksPerFrame = ticksPerSecond / frameRate;
    const newPos = Math.ceil(parseInt(currentPlayheadPosition) / ticksPerFrame);

    currentSequence.setPlayerPosition(String(newPos * ticksPerFrame));
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

    // Dirty coded dirty hack, premiere is... not exact with its ticks?!
    // If last marker has no name = This is my new marker. If it has a name -> stretched mode marker
    if (
      lastMarker.name === "0" ||
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
      lastMarker.name === "15"
    ) {
      return lastMarker;
    }
    return markerClips[markerCount - 2];
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
