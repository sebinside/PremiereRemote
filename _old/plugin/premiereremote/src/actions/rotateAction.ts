import { action, DialRotateEvent, SingletonAction } from "@elgato/streamdeck";
import { sendMessage } from '../socketManager';

@action({ UUID: "de.sebinside.premiereremote.rotate" })
export class RotateAction extends SingletonAction {
	override onDialRotate(ev: DialRotateEvent) {
		sendMessage(`rotate,${ev.payload.ticks}`);
	}

	override onDialDown(): Promise<void> | void {
		sendMessage('setRotate0');
	}
}