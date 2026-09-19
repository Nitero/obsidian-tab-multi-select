import {WorkspaceLeaf} from "obsidian";
import {TAB_HEADER_SELECTOR} from "../core/constants";
import {
	buildTabHeaderToLeafResolver,
	findTabGroupForHeader,
	listLeavesInGroupInDomOrder,
} from "../utils/domUtils";
import {PluginServices} from "../main";

export type ActiveTabContext = {
	activeLeaf: WorkspaceLeaf;
	doc: Document;
	group: HTMLElement;
	leavesInGroup: WorkspaceLeaf[];
};

export type SelectedTabContext = ActiveTabContext & {
	selectedLeaves: WorkspaceLeaf[];
	otherLeavesInGroup: WorkspaceLeaf[];
};

export function getActiveTabContext(services: PluginServices): ActiveTabContext | null {
	const activeLeaf = (services.app.workspace as { activeLeaf: WorkspaceLeaf | null }).activeLeaf;
	const header = activeLeaf?.tabHeaderEl?.closest(TAB_HEADER_SELECTOR) as HTMLElement | null;
	if (!header)
		return null;

	const group = findTabGroupForHeader(header);
	if (!group)
		return null;

	const resolveLeaf = buildTabHeaderToLeafResolver(services.app);
	services.selection.syncTabGroupSelectionFromDom(group, resolveLeaf);

	const resolvedActiveLeaf = resolveLeaf(header);
	if (!resolvedActiveLeaf || resolvedActiveLeaf !== activeLeaf)
		return null;

	const leavesInGroup = listLeavesInGroupInDomOrder(group, resolveLeaf);

	return {activeLeaf, doc: header.ownerDocument, group, leavesInGroup};
}

export function getSelectedTabContext(services: PluginServices): SelectedTabContext | null {
	const context = getActiveTabContext(services);
	if (!context)
		return null;

	const resolveLeaf = buildTabHeaderToLeafResolver(services.app);
	services.selection.syncTabGroupSelectionFromDom(context.group, resolveLeaf);

	const selectedLeaves = services.selection.getSelectedLeavesInTabGroup(context.doc, context.group, resolveLeaf);
	if (!selectedLeaves.includes(context.activeLeaf))
		return null;

	const selectedSet = new Set(selectedLeaves);
	const otherLeavesInGroup = context.leavesInGroup.filter((leaf) => !selectedSet.has(leaf));

	return {...context, selectedLeaves, otherLeavesInGroup};
}
