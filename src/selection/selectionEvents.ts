import {WorkspaceLeaf} from "obsidian";
import {DragController} from "../drag/dragController";
import {
	buildTabHeaderToLeafResolver,
	findActiveTabHeaderInGroup,
	findTabGroupForHeader,
	findTabHeaderFromEvent,
	isModifierPressed,
} from "../utils/domUtils";
import MultiSelectTabsPlugin, {PluginServices} from "../main";
import {TabActions} from "../actions/tabActions";

export class SelectionEventsController {
	private tabGroupToClearOnClick: HTMLElement | null = null;

	constructor(
		private services: PluginServices,
		private drag: DragController,
		private tabActions: TabActions
	) {
	}

	registerForDocument(doc: Document, plugin: MultiSelectTabsPlugin) {
		plugin.registerDomEvent(doc, "pointerdown", (event) => this.onPointerDownCapture(event), true);
		plugin.registerDomEvent(doc, "click", (event) => this.onClickCapture(event), true);

		plugin.registerDomEvent(doc, "pointerdown", (event) =>
			this.onPointerDownBubbleClearEmpty(event, doc)
		);
	}

	private onPointerDownBubbleClearEmpty(event: PointerEvent, doc: Document) {
		if (event.button !== 0)
			return;

		const header = findTabHeaderFromEvent(event);
		if (!header && !isModifierPressed(event) && !event.shiftKey)
			this.services.selection.clearDocumentSelection(doc);
	}

	private onPointerDownCapture(event: PointerEvent) {
		if (event.button === 1) {
			this.closeSelectionOnMiddleClick(event);
			return;
		}
		if (event.button !== 0)
			return;

		if (this.drag.isDragging())
			return;

		const header = findTabHeaderFromEvent(event);
		if (!header)
			return;

		const group = findTabGroupForHeader(header);
		if (!group)
			return;

		const resolveLeaf = buildTabHeaderToLeafResolver(this.services.app);
		this.services.selection.syncTabGroupSelectionFromDom(group, resolveLeaf);

		if (event.shiftKey) {
			this.handleShiftRange(event, group, header, resolveLeaf);
			return;
		}

		if (isModifierPressed(event)) {
			this.handleModifierToggle(event, group, header, resolveLeaf);
			return;
		}

		this.handlePlainClick(group, header, resolveLeaf);
	}

	private handleShiftRange(
		event: PointerEvent,
		group: HTMLElement,
		clickedHeader: HTMLElement,
		resolveLeaf: (h: HTMLElement) => WorkspaceLeaf | null
	) {
		const anchor = findActiveTabHeaderInGroup(group);
		if (!anchor)
			return;

		event.preventDefault();
		event.stopPropagation();

		this.services.selection.selectTabRangeInGroup(group, anchor, clickedHeader, resolveLeaf);
	}

	private handleModifierToggle(
		event: PointerEvent,
		group: HTMLElement,
		clickedHeader: HTMLElement,
		resolveLeaf: (h: HTMLElement) => WorkspaceLeaf | null
	) {
		event.preventDefault();
		event.stopPropagation();

		this.ensureActiveIncludedOnFirstMultiSelectInGroup(group, clickedHeader, resolveLeaf);

		this.services.selection.toggleTabHeaderSelection(clickedHeader, resolveLeaf);

		const doc = clickedHeader.ownerDocument;
		const selected = this.services.selection.getSelectedLeavesInTabGroup(doc, group, resolveLeaf);

		if (selected.length === 1) {
			const only = selected[0];
			if (only)
				this.services.app.workspace.setActiveLeaf(only, {focus: true});
			this.services.selection.clearTabGroupSelection(group, resolveLeaf);
		}
	}

	private handlePlainClick(
		group: HTMLElement,
		clickedHeader: HTMLElement,
		resolveLeaf: (h: HTMLElement) => WorkspaceLeaf | null
	) {
		const doc = clickedHeader.ownerDocument;

		const clickedLeaf = resolveLeaf(clickedHeader);
		if (!clickedLeaf)
			return;

		const selected = this.services.selection.getSelectedLeavesInTabGroup(doc, group, resolveLeaf);

		if (selected.includes(clickedLeaf)) {
			this.tabGroupToClearOnClick = group;
			return;
		}

		this.services.selection.clearTabGroupSelection(group, resolveLeaf);
	}

	private ensureActiveIncludedOnFirstMultiSelectInGroup(
		group: HTMLElement,
		clickedHeader: HTMLElement,
		resolveLeaf: (h: HTMLElement) => WorkspaceLeaf | null
	) {
		const doc = clickedHeader.ownerDocument;

		if (this.services.selection.getSelectedLeavesInTabGroup(doc, group, resolveLeaf).length > 0)
			return;

		const activeHeader = findActiveTabHeaderInGroup(group);
		if (!activeHeader)
			return;
		if (activeHeader === clickedHeader)
			return;

		this.services.selection.toggleTabHeaderSelection(activeHeader, resolveLeaf);
	}

	private closeSelectionOnMiddleClick(event: PointerEvent) {
		const header = findTabHeaderFromEvent(event);
		if (!header)
			return;

		const group = findTabGroupForHeader(header);
		if (!group)
			return;

		const resolveLeaf = buildTabHeaderToLeafResolver(this.services.app);
		this.services.selection.syncTabGroupSelectionFromDom(group, resolveLeaf);

		const doc = header.ownerDocument;
		const selectedInGroup = this.services.selection.getSelectedLeavesInTabGroup(doc, group, resolveLeaf);

		const clickedLeaf = resolveLeaf(header);
		if (!clickedLeaf)
			return;

		if (selectedInGroup.includes(clickedLeaf)) {
			event.preventDefault();
			event.stopPropagation();
			this.tabActions.closeTabs(selectedInGroup, true);
		}
	}

	private onClickCapture(event: MouseEvent) {
		if (event.button !== 0)
			return;

		if (this.drag.isDragging()) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}

		if (this.tabGroupToClearOnClick) {
			const group = this.tabGroupToClearOnClick;
			this.tabGroupToClearOnClick = null;

			const resolveLeaf = buildTabHeaderToLeafResolver(this.services.app);
			this.services.selection.clearTabGroupSelection(group, resolveLeaf);
			return;
		}

		const header = findTabHeaderFromEvent(event);
		if (!header)
			return;

		if (event.shiftKey || isModifierPressed(event)) {
			event.preventDefault();
			event.stopPropagation();
		}
	}
}
