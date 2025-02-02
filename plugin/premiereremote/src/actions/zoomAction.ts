import { action, DialRotateEvent, SingletonAction } from "@elgato/streamdeck";
import WebSocket from 'ws';

@action({ UUID: "de.sebinside.premiereremote.zoom" })
export class ZoomAction extends SingletonAction {
	private readonly websocketAddress = 'ws://localhost:8082';
	private ws = new WebSocket(this.websocketAddress);

	override onDialRotate(ev: DialRotateEvent) {
		this.reconnectWebSocket();
		this.ws.send(`zoom,${ev.payload.ticks}`);
	}

	override onDialDown(): Promise<void> | void {
		this.reconnectWebSocket();
		this.ws.send('setZoom100');
	}

	private reconnectWebSocket() {
		if (this.ws.readyState !== WebSocket.OPEN) {
			this.ws = new WebSocket(this.websocketAddress);
		}
	}

}