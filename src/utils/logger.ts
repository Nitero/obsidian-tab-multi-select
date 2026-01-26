import {LOGGER_PREFIX} from "../core/constants";

export class Logger {
	logWarn(...args: unknown[]) {
		console.warn(LOGGER_PREFIX, ...args);
	}

	logError(...args: unknown[]) {
		console.error(LOGGER_PREFIX, ...args);
	}
}
