import {CloseEntry} from "./closeHistory";
import {UNDO_CLOSE_PANE_COMMAND_ID} from "../core/constants";
import {PluginServices} from "../main";
import {patchNativeCommand} from "../utils/nativeCommandPatch";

export class UndoPatch {
	private unpatch: (() => void) | null = null;

	constructor(private services: PluginServices) {
	}

	install() {
		if (this.unpatch)
			return;

		this.unpatch = patchNativeCommand(this.services, UNDO_CLOSE_PANE_COMMAND_ID, (execNativeUndoOnce) => {
			if (this.services.closeHistory.isBatchUndoInProgress())
				return false;
			return this.runBatchedUndoIfAvailable(execNativeUndoOnce);
		});
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
			const entries = transaction.replayInRecordedOrder
				? transaction.entries
				: transaction.entries.slice().reverse();

			for (const entry of entries)
				this.undoOnceAndReposition(execNativeUndoOnce, entry);
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
