import type {App} from "obsidian";
import type {Logger} from "./logger";

export function executeCommand(id: string, app: App, logger: Logger): boolean {
	const commands = app.commands;

	try {
		if (commands.executeCommandById)
			return commands.executeCommandById(id);
		if (commands.executeCommand) {
			commands.executeCommand({id});
			return true;
		}
	} catch (e) {
		logger.logWarn(`${executeCommand.name} failed: ${id}`, e);
	}

	return false;
}
