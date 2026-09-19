import {App, WorkspaceLeaf} from "obsidian";
import {TAB_GROUP_SELECTOR, TAB_HEADER_SELECTOR} from "../core/constants";

export function isModifierPressed(event: MouseEvent | PointerEvent): boolean {
	return event.ctrlKey;
}

export function findTabHeaderFromEvent(event: Event): HTMLElement | null {
	const target = event.target as HTMLElement | null;
	if (!target)
		return null;
	return target.closest(TAB_HEADER_SELECTOR);
}

export function findTabGroupForHeader(header: HTMLElement): HTMLElement | null {
	return header.closest(TAB_GROUP_SELECTOR);
}

export function listTabHeadersInGroup(group: HTMLElement): HTMLElement[] {
	return Array.from(group.querySelectorAll<HTMLElement>(TAB_HEADER_SELECTOR));
}

export function findActiveTabHeaderInGroup(group: HTMLElement): HTMLElement | null {
	return (
		(group.querySelector(`${TAB_HEADER_SELECTOR}.is-active`)) ||
		(group.querySelector(`${TAB_HEADER_SELECTOR}[aria-selected='true']`)) ||
		(group.querySelector(`${TAB_HEADER_SELECTOR}.mod-active`))
	);
}

export function buildTabHeaderToLeafResolver(app: App) {
	const map = new Map<HTMLElement, WorkspaceLeaf>();
	app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
		const header = leaf.tabHeaderEl;
		if (header instanceof HTMLElement)
			map.set(header, leaf);
	});

	return (header: HTMLElement): WorkspaceLeaf | null => map.get(header) ?? null;
}

export function listRootLeavesInDocument(app: App, doc: Document): WorkspaceLeaf[] {
	const leaves: WorkspaceLeaf[] = [];
	app.workspace.iterateRootLeaves((leaf: WorkspaceLeaf) => {
		const leafDoc = leaf.tabHeaderEl?.ownerDocument ?? leaf.getContainer().doc;
		if (leafDoc === doc)
			leaves.push(leaf);
	});
	return leaves;
}

export function listLeavesInGroupInDomOrder(
	group: HTMLElement,
	resolveLeaf: (h: HTMLElement) => WorkspaceLeaf | null
): WorkspaceLeaf[] {
	const headers = listTabHeadersInGroup(group);
	return listLeavesForTabHeaders(headers, resolveLeaf);
}

function listLeavesForTabHeaders(
	headers: HTMLElement[],
	resolveLeaf: (h: HTMLElement) => WorkspaceLeaf | null
): WorkspaceLeaf[] {
	const out: WorkspaceLeaf[] = [];
	const seen = new Set<WorkspaceLeaf>();

	for (const header of headers) {
		const leaf = resolveLeaf(header);
		if (!leaf || seen.has(leaf))
			continue;
		seen.add(leaf);
		out.push(leaf);
	}
	return out;
}
