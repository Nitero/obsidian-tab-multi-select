import {PluginServices} from "../main";
import {patchMethod} from "./patchUtils";

type NativeCommandExecutor = () => boolean;
type NativeCommandHandler = (executeNativeCommand: NativeCommandExecutor) => boolean;

export function patchNativeCommand(
	services: PluginServices,
	commandId: string,
	handle: NativeCommandHandler
): (() => void) | null {
	const commands = services.app.commands;
	if (!commands)
		return null;

	const origExecuteById = commands.executeCommandById;
	const origExecuteCmd = commands.executeCommand;
	const command = commands.commands?.[commandId];
	const origCallback = command?.callback;
	const origCheckCallback = command?.checkCallback;
	const unpatches: Array<() => void> = [];
	let runningNativeCommand = false;

	const runNativeCommand = (run: () => boolean): boolean => {
		runningNativeCommand = true;
		try {
			return run();
		} finally {
			runningNativeCommand = false;
		}
	};

	const executeNativeCommand = (): boolean => {
		return runNativeCommand(() => {
			try {
				if (origCheckCallback)
					return origCheckCallback.call(command, false) !== false;
				if (origCallback) {
					origCallback.call(command);
					return true;
				}

				if (origExecuteById)
					return origExecuteById.call(commands, commandId);
				if (origExecuteCmd) {
					origExecuteCmd.call(commands, {id: commandId});
					return true;
				}
			} catch (e) {
				services.logger.logWarn(`native command failed: ${commandId}`, e);
			}
			return false;
		});
	};

	if (origExecuteById) {
		unpatches.push(
			patchMethod(commands, "executeCommandById", (orig) => {
				return ((id: string) => {
					if (!runningNativeCommand && id === commandId && handle(executeNativeCommand))
						return true;
					return (orig as (id: string) => unknown).call(commands, id);
				}) as typeof commands.executeCommandById;
			})
		);
	}

	if (origExecuteCmd) {
		unpatches.push(
			patchMethod(commands, "executeCommand", (orig) => {
				return ((cmd: { id: string }) => {
					if (!runningNativeCommand && cmd?.id === commandId && handle(executeNativeCommand))
						return;
					return (orig as (cmd: { id: string }) => unknown).call(commands, cmd);
				});
			})
		);
	}

	if (command?.callback) {
		unpatches.push(
			patchMethod(command, "callback", (orig) => {
				return (() => {
					if (!runningNativeCommand && handle(executeNativeCommand))
						return true;
					return (orig as () => unknown).call(command);
				}) as typeof command.callback;
			})
		);
	}

	if (command?.checkCallback) {
		const commandWithCheckCallback = command as typeof command & {
			checkCallback: (checking: boolean) => boolean | void;
		};

		unpatches.push(
			patchMethod(commandWithCheckCallback, "checkCallback", (orig) => {
				return ((checking: boolean) => {
					if (checking)
						return orig.call(commandWithCheckCallback, checking);
					if (!runningNativeCommand && handle(executeNativeCommand))
						return true;
					return orig.call(commandWithCheckCallback, checking);
				});
			})
		);
	}

	return () => unpatches.slice().reverse().forEach((fn) => fn());
}
