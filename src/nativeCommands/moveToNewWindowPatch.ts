import {MOVE_TO_NEW_WINDOW_COMMAND_ID} from "../core/constants";
import {PluginServices} from "../main";
import {patchNativeCommand} from "../utils/nativeCommandPatch";
import {getSelectedTabContext} from "./selectedTabContext";
import {TabActions} from "../actions/tabActions";

export class MoveToNewWindowPatch {
	private unpatch: (() => void) | null = null;
	private runningNativeCommand = false;

	constructor(
		private services: PluginServices,
		private tabActions: TabActions
	) {
	}

	install() {
		if (this.unpatch)
			return;

		this.unpatch = patchNativeCommand(
			this.services,
			MOVE_TO_NEW_WINDOW_COMMAND_ID,
			() => this.moveSelectedTabsToNewWindow(),
		);
	}

	uninstall() {
		this.unpatch?.();
		this.unpatch = null;
	}

	private moveSelectedTabsToNewWindow(): boolean {
		if (this.runningNativeCommand)
			return false;

		const context = getSelectedTabContext(this.services);
		if (!context || context.selectedLeaves.length < 2)
			return false;

		this.runningNativeCommand = true;
		try {
			this.tabActions.moveTabsToNewWindow(context.selectedLeaves);
		} finally {
			this.runningNativeCommand = false;
		}

		return true;
	}
}
