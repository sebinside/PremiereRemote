import { action, DialRotateEvent, SingletonAction } from "@elgato/streamdeck";
import { sendMessage } from '../socketManager';

@action({ UUID: "de.sebinside.premiereremote.ymove" })
export class YMoveAction extends SingletonAction {
	private pressModifier = 6;
	override onDialRotate(ev: DialRotateEvent) {
		if(!ev.payload.pressed) {
			sendMessage(`ymove,${ev.payload.ticks * this.pressModifier}`);
		} else {
			sendMessage(`ymove,${ev.payload.ticks}`);
		}
	}
}
