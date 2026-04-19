import { action, DialRotateEvent, SingletonAction } from "@elgato/streamdeck";
import { sendMessage } from '../socketManager';

@action({ UUID: "de.sebinside.premiereremote.zoom" })
export class ZoomAction extends SingletonAction {
	override onDialRotate(ev: DialRotateEvent) {
		sendMessage(`zoom,${ev.payload.ticks}`);
	}

	override onDialDown(): Promise<void> | void {
		sendMessage('setZoom100');
	}
}
