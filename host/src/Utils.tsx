export class Utils {
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

    static setZoomOfCurrentClip(zoomLevel: number) {
      const clipInfo = Utils.getFirstSelectedClip(true)
      const scaleInfo = clipInfo.clip.components[1].properties[1];
      scaleInfo.setValue(zoomLevel, true);
    }
    
    static changeZoom(value: string) {
      const clipInfo = Utils.getFirstSelectedClip(true)
      const scaleInfo = clipInfo.clip.components[1].properties[1];
      scaleInfo.setValue(scaleInfo.getValue() + parseInt(value), true);
    }
  
    static zoomToFit(videoClip) {
      if(videoClip != null) {
        const clipSize = this.getClipSize(videoClip.clip);
        const frameHeight = app.project.activeSequence.frameSizeVertical;
        const frameWidth = app.project.activeSequence.frameSizeHorizontal;
  
        const verticalFactor = frameHeight / clipSize.height;
        const horizontalFactor = frameWidth / clipSize.width;
        
        const zoomLevel = Math.max(verticalFactor, horizontalFactor) * 100;
  
        Utils.setZoomOfCurrentClip(zoomLevel);
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