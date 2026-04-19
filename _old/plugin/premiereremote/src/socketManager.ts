import WebSocket from 'ws';

const websocketAddress = 'ws://localhost:8082';
let websocketConnection = new WebSocket(websocketAddress);

function reconnectWebSocket() {
    if (websocketConnection.readyState !== WebSocket.OPEN) {
        websocketConnection = new WebSocket(websocketAddress);
    }
}

export function sendMessage(message: string) {
    reconnectWebSocket();
    websocketConnection.send(message);
}