import {
	CLOSE_OTHER_TABS_COMMAND_ID,
	CLOSE_OTHER_TABS_IN_GROUP_COMMAND_ID,
} from "../core/constants";
import {PluginServices} from "../main";
import {patchNativeCommand} from "../utils/nativeCommandPatch";
import {ActiveTabContext, getActiveTabContext, getSelectedTabContext, SelectedTabContext} from "./selectedTabContext";
import {TabActions} from "../actions/tabActions";
import {WorkspaceLeaf} from "obsidian";

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
		const context = getSelectedTabContext(this.services) ?? getActiveTabContext(this.services);
		if (!context)
			return false;

		const rootLeaves = this.getRootLeavesInDocument(context.doc);
		if (!rootLeaves.includes(context.activeLeaf))
			return false;

		const leavesToKeep = this.getLeavesToKeep(context);
		const keepSet = new Set(leavesToKeep);
		const leavesToClose = rootLeaves.filter((leaf) => !keepSet.has(leaf));

		if (leavesToClose.length > 0)
			this.tabActions.closeTabs(leavesToClose, false);
		return true;
	}

	private closeOtherTabsInGroup(): boolean {
		const context = getSelectedTabContext(this.services) ?? getActiveTabContext(this.services);
		if (!context)
			return false;

		const leavesToKeep = this.getLeavesToKeep(context);
		const keepSet = new Set(leavesToKeep);
		const leavesToClose = context.leavesInGroup.filter((leaf) => !keepSet.has(leaf));

		if (leavesToClose.length > 0)
			this.tabActions.closeTabs(leavesToClose, false);
		return true;
	}

	private getRootLeavesInDocument(doc: Document): WorkspaceLeaf[] {
		const leaves: WorkspaceLeaf[] = [];
		this.services.app.workspace.iterateRootLeaves((leaf) => {
			const leafDoc = leaf.tabHeaderEl?.ownerDocument ?? leaf.getContainer().doc;
			if (leafDoc === doc)
				leaves.push(leaf);
		});
		return leaves;
	}

	private getLeavesToKeep(context: ActiveTabContext | SelectedTabContext): WorkspaceLeaf[] {
		return this.hasSelectedLeaves(context)
			? context.selectedLeaves
			: [context.activeLeaf];
	}

	private hasSelectedLeaves(context: ActiveTabContext | SelectedTabContext): context is SelectedTabContext {
		return "selectedLeaves" in context;
	}
}
