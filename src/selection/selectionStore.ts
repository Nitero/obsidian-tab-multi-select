import {WorkspaceLeaf} from "obsidian";
import {listTabHeadersInGroup} from "../utils/domUtils";
import {SELECTED_HEADER_CLASS} from "../core/constants";

export class SelectionStore {
	private selectedLeavesByDoc = new WeakMap<Document, Set<WorkspaceLeaf>>();

	clearDocumentSelection(doc: Document) {
		const selection = this.selectedLeavesByDoc.get(doc);
		if (!selection || selection.size === 0)
			return;

		for (const leaf of selection)
			this.setLeafSelection(doc, leaf, false);
		selection.clear();
	}

	setDocumentSelection(doc: Document, leaves: WorkspaceLeaf[]) {
		this.clearDocumentSelection(doc);
		const selection = this.getOrCreateDocumentSelection(doc);

		for (const leaf of leaves) {
			const header = this.getTabHeader(leaf, doc);
			if (!header)
				continue;
			selection.add(leaf);
			this.setTabHeaderSelected(header, true);
		}
	}

	clearTabGroupSelection(
		tabGroup: HTMLElement,
		resolveLeaf: (h: HTMLElement) => WorkspaceLeaf | null
	) {
		const doc = tabGroup.ownerDocument;
		const selection = this.getOrCreateDocumentSelection(doc);

		for (const header of listTabHeadersInGroup(tabGroup)) {
			const leaf = resolveLeaf(header);
			if (!leaf)
				continue;
			if (!selection.has(leaf))
				continue;

			selection.delete(leaf);
			this.setTabHeaderSelected(header, false);
		}
	}

	toggleTabHeaderSelection(
		header: HTMLElement,
		resolveLeaf: (h: HTMLElement) => WorkspaceLeaf | null
	) {
		const doc = header.ownerDocument;
		const selection = this.getOrCreateDocumentSelection(doc);

		const leaf = resolveLeaf(header);
		if (!leaf)
			return;

		const next = !selection.has(leaf);
		if (next)
			selection.add(leaf);
		else
			selection.delete(leaf);

		this.setTabHeaderSelected(header, next);
	}

	selectTabRangeInGroup(
		tabGroup: HTMLElement,
		fromHeader: HTMLElement,
		toHeader: HTMLElement,
		resolveLeaf: (h: HTMLElement) => WorkspaceLeaf | null
	) {
		const doc = tabGroup.ownerDocument;
		const headers = listTabHeadersInGroup(tabGroup);

		const fromIndex = headers.indexOf(fromHeader);
		const toIndex = headers.indexOf(toHeader);
		if (fromIndex < 0 || toIndex < 0)
			return;

		const [start, end] = fromIndex < toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];

		this.clearTabGroupSelection(tabGroup, resolveLeaf);

		const selection = this.getOrCreateDocumentSelection(doc);
		for (let i = start; i <= end; i++) {
			const header = headers[i];
			if (!header)
				continue;

			const leaf = resolveLeaf(header);
			if (!leaf)
				continue;

			selection.add(leaf);
			this.setTabHeaderSelected(header, true);
		}
	}

	getSelectedLeavesInTabGroup(
		doc: Document,
		group: HTMLElement,
		resolveLeaf: (h: HTMLElement) => WorkspaceLeaf | null
	): WorkspaceLeaf[] {
		const selection = this.getOrCreateDocumentSelection(doc);

		const out: WorkspaceLeaf[] = [];
		const seen = new Set<WorkspaceLeaf>();

		for (const header of listTabHeadersInGroup(group)) {
			const leaf = resolveLeaf(header);
			if (!leaf)
				continue;
			if (!selection.has(leaf))
				continue;
			if (seen.has(leaf))
				continue;

			seen.add(leaf);
			out.push(leaf);
		}

		return out;
	}

	syncTabGroupSelectionFromDom(
		group: HTMLElement,
		resolveLeaf: (h: HTMLElement) => WorkspaceLeaf | null
	) {
		const doc = group.ownerDocument;
		const selection = this.getOrCreateDocumentSelection(doc);

		for (const header of listTabHeadersInGroup(group)) {
			const leaf = resolveLeaf(header);
			if (!leaf)
				continue;

			const domSelected = header.classList.contains(SELECTED_HEADER_CLASS);
			const tracked = selection.has(leaf);

			if (domSelected && !tracked) selection.add(leaf);
			else if (!domSelected && tracked) selection.delete(leaf);
		}
	}

	private getOrCreateDocumentSelection(doc: Document): Set<WorkspaceLeaf> {
		let selection = this.selectedLeavesByDoc.get(doc);
		if (!selection) {
			selection = new Set<WorkspaceLeaf>();
			this.selectedLeavesByDoc.set(doc, selection);
		}
		return selection;
	}

	private getTabHeader(leaf: WorkspaceLeaf, doc: Document): HTMLElement | null {
		const header = leaf.tabHeaderEl as HTMLElement | null;
		if (!header)
			return null;
		if (header.ownerDocument !== doc)
			return null;
		return header;
	}

	private setTabHeaderSelected(header: HTMLElement, selected: boolean) {
		header.classList.toggle(SELECTED_HEADER_CLASS, selected);
	}

	private setLeafSelection(doc: Document, leaf: WorkspaceLeaf, selected: boolean) {
		const header = this.getTabHeader(leaf, doc);
		if (!header)
			return;
		this.setTabHeaderSelected(header, selected);
	}
}
