import streamDeck, { LogLevel } from "@elgato/streamdeck";
import { ZoomAction } from "./actions/zoomAction";
import { RotateAction } from "./actions/rotateAction";
import { YMoveAction } from "./actions/yMoveAction";
import { XMoveAction } from "./actions/xMoveAction";

streamDeck.logger.setLevel(LogLevel.WARN);
streamDeck.actions.registerAction(new ZoomAction());
streamDeck.actions.registerAction(new RotateAction());
streamDeck.actions.registerAction(new YMoveAction());
streamDeck.actions.registerAction(new XMoveAction());
streamDeck.connect();
