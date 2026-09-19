import {TOGGLE_PIN_COMMAND_ID} from "../core/constants";
import {PluginServices} from "../main";
import {patchNativeCommand} from "../utils/nativeCommandPatch";
import {getSelectedTabContext} from "./selectedTabContext";
import {TabActions} from "../actions/tabActions";

export class TogglePinPatch {
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
			TOGGLE_PIN_COMMAND_ID,
			() => this.toggleSelectedPins(),
		);
	}

	uninstall() {
		this.unpatch?.();
		this.unpatch = null;
	}

	private toggleSelectedPins(): boolean {
		const context = getSelectedTabContext(this.services);
		if (!context || context.selectedLeaves.length < 2)
			return false;

		this.tabActions.togglePinTabs(context.selectedLeaves, context.activeLeaf);
		return true;
	}
}
