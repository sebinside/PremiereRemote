import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { ZoomAction } from "./actions/zoomAction";

streamDeck.logger.setLevel(LogLevel.WARN);
streamDeck.actions.registerAction(new ZoomAction());
streamDeck.connect();
