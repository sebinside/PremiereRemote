import { action, DialRotateEvent, SingletonAction } from "@elgato/streamdeck";
import { sendMessage } from '../socketManager';

@action({ UUID: "de.sebinside.premiereremote.xmove" })
export class XMoveAction extends SingletonAction {
	private pressModifier = 6;
	override onDialRotate(ev: DialRotateEvent) {
		if(!ev.payload.pressed) {
			sendMessage(`xmove,${ev.payload.ticks * this.pressModifier}`);
		} else {
			sendMessage(`xmove,${ev.payload.ticks}`);
		}
	}
}
