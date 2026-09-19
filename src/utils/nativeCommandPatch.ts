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
	const unpatches: Array<() => void> = [];

	const executeNativeCommand = (): boolean => {
		try {
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
	};

	if (origExecuteById) {
		unpatches.push(
			patchMethod(commands, "executeCommandById", (orig) => {
				return ((id: string) => {
					if (id === commandId && handle(executeNativeCommand))
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
					if (cmd?.id === commandId && handle(executeNativeCommand))
						return;
					return (orig as (cmd: { id: string }) => unknown).call(commands, cmd);
				});
			})
		);
	}

	return () => unpatches.slice().reverse().forEach((fn) => fn());
}
