/// <reference path="../typings/JavaScript.d.ts"/>
/// <reference path="../typings/PlugPlugExternalObject.d.ts"/>
/// <reference path="../typings/PremierePro.14.0.d.ts"/>
/// <reference path="../typings/XMPScript.d.ts"/>
/// <reference path="../typings/extendscript.d.ts"/>
/// <reference path="../typings/global.d.ts"/>

import { Utils } from "./Utils";

export class EffectUtils {

    static changeAudioLevel(clip: TrackItem, levelInDb: number) {
      const levelInfo = clip.components[0].properties[1];
      const level = 20 * Math.log(parseFloat(levelInfo.getValue())) * Math.LOG10E + 15;
      const newLevel = level + levelInDb;
      const encodedLevel = Math.min(Math.pow(10, (newLevel - 15)/20), 1.0);
      levelInfo.setValue(encodedLevel, true);
    }
  
    static changeAllAudioLevels(levelInDb: number) {
      const currentSequence = app.project.activeSequence;
      for (let i = 0; i < currentSequence.audioTracks.numTracks; i++) {
        for (let j = 0; j < currentSequence.audioTracks[i].clips.numItems; j++) {
            const currentClip = currentSequence.audioTracks[i].clips[j];
            if(currentClip.isSelected()) {
             this.changeAudioLevel(currentClip, levelInDb);
            }
        }
      }
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