import {
	CLOSE_OTHER_TABS_COMMAND_ID,
	CLOSE_OTHER_TABS_IN_GROUP_COMMAND_ID,
} from "../core/constants";
import {PluginServices} from "../main";
import {patchNativeCommand} from "../utils/nativeCommandPatch";
import {buildTabHeaderToLeafResolver, listRootLeavesInDocument} from "../utils/domUtils";
import {getActiveTabContext} from "./selectedTabContext";
import {TabActions} from "../actions/tabActions";

export class CloseOthersPatch {
	private unpatch: (() => void) | null = null;

	constructor(
		private services: PluginServices,
		private tabActions: TabActions
	) {
	}

	install() {
		if (this.unpatch)
			return;

		const unpatchCloseOthers = patchNativeCommand(
			this.services,
			CLOSE_OTHER_TABS_COMMAND_ID,
			() => this.closeOtherTabsInDocument(),
		);
		const unpatchCloseOthersInGroup = patchNativeCommand(
			this.services,
			CLOSE_OTHER_TABS_IN_GROUP_COMMAND_ID,
			() => this.closeOtherTabsInGroup(),
		);
		const unpatches = [unpatchCloseOthers, unpatchCloseOthersInGroup]
			.filter((fn): fn is () => void => fn != null);

		this.unpatch = () => unpatches.slice().reverse().forEach((fn) => fn());
	}

	uninstall() {
		this.unpatch?.();
		this.unpatch = null;
	}

	private closeOtherTabsInDocument(): boolean {
		const context = getActiveTabContext(this.services);
		if (!context)
			return false;

		const rootLeaves = listRootLeavesInDocument(this.services.app, context.doc);
		if (!rootLeaves.includes(context.activeLeaf))
			return false;

		const selectedLeaves = this.services.selection.getSelectedLeavesInDocument(context.doc, rootLeaves);
		const usedSelectedTabs = selectedLeaves.includes(context.activeLeaf);
		const leavesToKeep = usedSelectedTabs
			? selectedLeaves
			: [context.activeLeaf];
		const keepSet = new Set(leavesToKeep);
		const leavesToClose = rootLeaves.filter((leaf) => !keepSet.has(leaf));

		if (leavesToClose.length > 0)
			this.tabActions.closeTabs(leavesToClose, false);
		if (usedSelectedTabs)
			this.services.selection.clearDocumentSelection(context.doc);
		return true;
	}

	private closeOtherTabsInGroup(): boolean {
		const context = getActiveTabContext(this.services);
		if (!context)
			return false;

		const resolveLeaf = buildTabHeaderToLeafResolver(this.services.app);
		this.services.selection.syncTabGroupSelectionFromDom(context.group, resolveLeaf);

		const selectedLeaves = this.services.selection.getSelectedLeavesInTabGroup(context.doc, context.group, resolveLeaf);
		const usedSelectedTabs = selectedLeaves.includes(context.activeLeaf);
		const leavesToKeep = usedSelectedTabs
			? selectedLeaves
			: [context.activeLeaf];
		const keepSet = new Set(leavesToKeep);
		const leavesToClose = context.leavesInGroup.filter((leaf) => !keepSet.has(leaf));

		if (leavesToClose.length > 0)
			this.tabActions.closeTabs(leavesToClose, false);
		if (usedSelectedTabs)
			this.services.selection.clearTabGroupSelection(context.group, resolveLeaf);
		return true;
	}
}
