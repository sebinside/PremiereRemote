/**
 * @fileoverview This file contains common utility functions that can be used to either build more advanced actions or by AI agents to query the state as part of the MCP server.
 */

import type {
    premierepro,
    Sequence,
    TickTime,
    VideoTrack,
} from "@adobe/premierepro";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ppro = require("premierepro") as premierepro;
const { Constants } = ppro;

export async function getActiveSequence(): Promise<Sequence | null> {
    const project = await ppro.Project.getActiveProject();
    if (!project) return null;

    const sequence = await project.getActiveSequence();
    if (!sequence) return null;

    return sequence;
}

/**
 * Returns the name of the active sequence, i.e., the sequence that is currently visible in the timeline panel.
 * @returns The name of the active sequence or null if no sequence is active.
 */
export async function getActiveSequenceName(): Promise<string | null> {
    const sequence = await getActiveSequence();
    if (!sequence) return null;

    return sequence.name;
}

type TimeStamp = {
    seconds: number;
    ticks: number;
};

type VideoTrackItemDetails = {
    name: string;
    isSelected: boolean;
    isDisabled: boolean;
    isAdjustmentLayer: boolean;
    inPoint: TimeStamp;
    outPoint: TimeStamp;
    duration: TimeStamp;
    startTime: TimeStamp;
    endTime: TimeStamp;
};

type VideoTrackDetails = {
    index: number;
    name: string;
    items: Array<VideoTrackItemDetails>;
};

/**
 * Returns the details of all clips of all video tracks. If a `trackIndex` is specified, the result is limited to this track.
 * @param trackIndex An optional, non-negative index of the track to limit the result to.
 * @returns An array of `VideoTrackDetails`, which may be empty if the specified track has not been found or no tracks exist.
 */
export async function getAllVideoClips(
    trackIndex?: number,
): Promise<Array<VideoTrackDetails>> {
    const activeSequence = await getActiveSequence();
    if (!activeSequence) return [];

    const trackCount = await activeSequence.getVideoTrackCount();
    if (trackIndex !== undefined && trackIndex >= trackCount) return [];

    let relevantTracks: VideoTrack[] = [];
    if (trackIndex !== undefined) {
        relevantTracks = [await activeSequence.getVideoTrack(trackIndex)];
    } else {
        for (let i = 0; i < trackCount; i++) {
            relevantTracks.push(await activeSequence.getVideoTrack(i));
        }
    }

    const trackDetails: VideoTrackDetails[] = await Promise.all(
        relevantTracks.map(async (track) => {
            const index = await track.getIndex();
            const name = track.name;
            const trackItems = track.getTrackItems(
                Constants.TrackItemType.CLIP,
                false,
            );

            let converToTimeStamp = (t: TickTime): TimeStamp => {
                return { seconds: t.seconds, ticks: t.ticksNumber };
            };

            const items: VideoTrackItemDetails[] = await Promise.all(
                trackItems.map(async (item) => {
                    return {
                        name: await item.getName(),
                        isSelected: await item.getIsSelected(),
                        isDisabled: await item.isDisabled(),
                        isAdjustmentLayer: await item.isAdjustmentLayer(),
                        inPoint: await item
                            .getInPoint()
                            .then((t) => converToTimeStamp(t)),
                        outPoint: await item
                            .getOutPoint()
                            .then((t) => converToTimeStamp(t)),
                        duration: await item
                            .getDuration()
                            .then((t) => converToTimeStamp(t)),
                        startTime: await item
                            .getStartTime()
                            .then((t) => converToTimeStamp(t)),
                        endTime: await item
                            .getEndTime()
                            .then((t) => converToTimeStamp(t)),
                    };
                }),
            );

            return {
                index,
                name,
                items,
            };
        }),
    );

    return trackDetails;
}
