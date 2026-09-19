import {CLOSE_CURRENT_TAB_COMMAND_ID} from "../core/constants";
import {PluginServices} from "../main";
import {patchNativeCommand} from "../utils/nativeCommandPatch";
import {getSelectedTabContext} from "./selectedTabContext";
import {TabActions} from "../actions/tabActions";

export class ClosePatch {
	private unpatch: (() => void) | null = null;

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
			CLOSE_CURRENT_TAB_COMMAND_ID,
			() => this.closeSelectedTabs(),
		);
	}

	uninstall() {
		this.unpatch?.();
		this.unpatch = null;
	}

	private closeSelectedTabs(): boolean {
		const context = getSelectedTabContext(this.services);
		if (!context || context.selectedLeaves.length < 2)
			return false;

		this.tabActions.closeTabs(context.selectedLeaves.slice(), true);
		return true;
	}
}
