import {addIcon, Menu, Notice} from "obsidian";
import {
	buildTabHeaderToLeafResolver,
	listLeavesInGroupInDomOrder,
	findTabGroupForHeader,
	findTabHeaderFromEvent,
} from "../utils/domUtils";
import MultiSelectTabsPlugin, {PluginServices} from "../main";
import {TabActions} from "./tabActions";

export class ContextMenuController {
	constructor(
		private services: PluginServices,
		private tabActions: TabActions
	) {
	}

	registerForDocument(doc: Document, plugin: MultiSelectTabsPlugin) {
		plugin.registerDomEvent(doc, "contextmenu", (event: MouseEvent) => this.onContextMenuCapture(event), true);
	}

	private onContextMenuCapture(event: MouseEvent) {
		const header = findTabHeaderFromEvent(event);
		if (!header)
			return;

		const doc = header.ownerDocument;
		const group = findTabGroupForHeader(header);
		if (!group)
			return;

		const resolveLeaf = buildTabHeaderToLeafResolver(this.services.app);
		this.services.selection.syncTabGroupSelectionFromDom(group, resolveLeaf);

		const clickedLeaf = resolveLeaf(header);
		if (!clickedLeaf)
			return;

		const selectedInGroup = this.services.selection.getSelectedLeavesInTabGroup(doc, group, resolveLeaf);
		if (!selectedInGroup.includes(clickedLeaf))
			return;
		if (selectedInGroup.length === 0)
			return;

		event.preventDefault();
		event.stopPropagation();

		const selectionSnapshot = selectedInGroup.slice();
		const allLeavesInGroup = listLeavesInGroupInDomOrder(group, resolveLeaf);
		const otherLeavesInGroup = allLeavesInGroup.filter((leaf) => !selectionSnapshot.includes(leaf));

		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle(`Close selected (${selectionSnapshot.length})`);
			item.setIcon("x");
			item.onClick(() => this.tabActions.closeTabs(selectionSnapshot, true));
		});

		menu.addItem((item) => {
			item.setTitle(`Close all others in group (${otherLeavesInGroup.length})`);
			item.setIcon("x");
			item.setDisabled(otherLeavesInGroup.length === 0);
			item.onClick(() => this.tabActions.closeTabs(otherLeavesInGroup, false));
		});

		menu.addSeparator();

		menu.addItem((item) => {
			item.setTitle("Pin selected");
			item.setIcon("pin");
			item.onClick(() => this.tabActions.pinTabs(selectionSnapshot));
		});

		menu.addItem((item) => {
			item.setTitle("Unpin selected");
			item.setIcon("pin-off");
			item.onClick(() => this.tabActions.unpinTabs(selectionSnapshot));
		});

		menu.addItem((item) => {
			item.setTitle("Toggle pin selected");
			item.setIcon("pin-toggle");
			item.onClick(() => this.tabActions.togglePinTabs(selectedInGroup, clickedLeaf));
		});

		menu.addSeparator();

		menu.addItem((item) => {
			item.setTitle("Move selected to new window");
			item.setIcon("picture-in-picture");
			item.onClick(() => this.tabActions.moveTabsToNewWindow(selectionSnapshot));
		});

		menu.addSeparator();

		menu.addItem((item) => {
			item.setTitle("Clear selection");
			item.setIcon("minus-circle");
			item.onClick(() => {
				this.services.selection.clearTabGroupSelection(group, resolveLeaf);
				new Notice("Selection cleared.");
			});
		});

		menu.showAtMouseEvent(event);
	}
}
