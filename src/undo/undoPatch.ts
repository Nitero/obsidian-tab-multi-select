import {CloseEntry} from "./closeHistory";
import {UNDO_CLOSE_PANE_COMMAND_ID} from "../core/constants";
import {PluginServices} from "../main";
import {patchMethod} from "../utils/patchUtils";

export class UndoPatch {
	private unpatch: (() => void) | null = null;

	constructor(private services: PluginServices) {
	}

	install() {
		if (this.unpatch)
			return;

		const commands = this.services.app.commands;
		if (!commands)
			return;

		const origExecuteById = commands.executeCommandById;
		const origExecuteCmd = commands.executeCommand;

		const execNativeUndoOnce = (): boolean => {
			try {
				if (origExecuteById)
					return origExecuteById.call(commands, UNDO_CLOSE_PANE_COMMAND_ID);
				if (origExecuteCmd) {
					origExecuteCmd.call(commands, {id: UNDO_CLOSE_PANE_COMMAND_ID});
					return true;
				}
			} catch (e) {
				this.services.logger.logWarn("native undo failed", e);
			}
			return false;
		};

		const maybeHandleUndo = (): boolean => {
			if (this.services.closeHistory.isBatchUndoInProgress())
				return false;
			return this.runBatchedUndoIfAvailable(execNativeUndoOnce);
		};

		const unpatches: Array<() => void> = [];

		if (origExecuteById) {
			unpatches.push(
				patchMethod(commands, "executeCommandById", (orig) => {
					return ((id: string) => {
						if (id === UNDO_CLOSE_PANE_COMMAND_ID && maybeHandleUndo()) return true;
						return (orig as (id: string) => unknown).call(commands, id);
					}) as typeof commands.executeCommandById;
				})
			);
		}

		if (origExecuteCmd) {
			unpatches.push(
				patchMethod(commands, "executeCommand", (orig) => {
					return ((cmd: { id: string }) => {
						if (cmd?.id === UNDO_CLOSE_PANE_COMMAND_ID && maybeHandleUndo())
							return;
						return (orig as (cmd: { id: string }) => unknown).call(commands, cmd);
					}) as typeof commands.executeCommand;
				})
			);
		}

		this.unpatch = () => unpatches.forEach((fn) => fn());
	}

	uninstall() {
		this.unpatch?.();
		this.unpatch = null;
	}

	private runBatchedUndoIfAvailable(execNativeUndoOnce: () => boolean): boolean {
		const transaction = this.services.closeHistory.popLastTransaction();
		if (!transaction || transaction.entries.length === 0)
			return false;

		this.services.closeHistory.setBatchUndoInProgress(true);
		try {
			for (let i = transaction.entries.length - 1; i >= 0; i--) {
				const entry = transaction.entries[i];
				if (entry)
					this.undoOnceAndReposition(execNativeUndoOnce, entry);
			}
		} finally {
			this.services.closeHistory.setBatchUndoInProgress(false);
		}

		return true;
	}

	private undoOnceAndReposition(execNativeUndoOnce: () => boolean, entry: CloseEntry) {
		const parent = entry.parent;
		if (!parent) {
			execNativeUndoOnce();
			return;
		}

		const before = parent.children.slice();
		execNativeUndoOnce();

		const active = this.services.app.workspace.getLeaf();
		const reopened =
			active && active.parent === parent && !before.includes(active)
				? active
				: parent.children.find((leaf) => !before.includes(leaf));

		if (!reopened || reopened.parent !== parent)
			return;

		try {
			parent.removeChild(reopened);
			parent.insertChild(Math.clamp(entry.index, 0, parent.children.length), reopened);
			parent.updateSlidingTabs?.();
		} catch (e) {
			this.services.logger.logWarn(`${this.undoOnceAndReposition.name} failed`, e);
		}
	}
}
