import {WorkspaceLeaf, WorkspaceTabs} from "obsidian";
import {
	buildTabHeaderToLeafResolver,
	findTabHeaderFromEvent,
	findTabGroupForHeader,
	listTabHeadersInGroup,
} from "../utils/domUtils";
import MultiSelectTabsPlugin, {PluginServices} from "../main";
import {TabActions} from "../actions/tabActions";

type OriginalTabPosition = { leaf: WorkspaceLeaf; parent: WorkspaceTabs; index: number };

export class DragController {
	private isMultiDragActive = false;
	private sourceDocument: Document | null = null;
	private primaryDraggedLeaf: WorkspaceLeaf | null = null;
	private draggedLeavesInDomOrder: WorkspaceLeaf[] = [];
	private originalTabPositions: OriginalTabPosition[] = [];

	private suppressClicksDuringDrag = false;

	constructor(
		private services: PluginServices,
		private tabActions: TabActions
	) {
	}

	isDragging() {
		return this.isMultiDragActive || this.suppressClicksDuringDrag;
	}

	registerForDocument(doc: Document, plugin: MultiSelectTabsPlugin) {
		plugin.registerDomEvent(doc, "dragstart", (event: DragEvent) => this.onDragStart(event), true);
		plugin.registerDomEvent(doc, "dragend", (event: DragEvent) => this.onDragEnd(event), true);
	}

	private onDragStart(event: DragEvent) {
		const header = findTabHeaderFromEvent(event);
		if (!header)
			return;

		const doc = header.ownerDocument;
		const group = findTabGroupForHeader(header);
		if (!group)
			return;

		const resolveLeaf = buildTabHeaderToLeafResolver(this.services.app);
		this.services.selection.syncTabGroupSelectionFromDom(group, resolveLeaf);

		const selectedLeavesInGroup = this.services.selection.getSelectedLeavesInTabGroup(doc, group, resolveLeaf);
		if (selectedLeavesInGroup.length < 2)
			return;

		const draggedLeaf = resolveLeaf(header);
		if (!draggedLeaf)
			return;
		if (!selectedLeavesInGroup.includes(draggedLeaf))
			return;

		const leavesInOrder = this.getSelectedLeavesInDomOrder(group, selectedLeavesInGroup, resolveLeaf);

		this.isMultiDragActive = true;
		this.suppressClicksDuringDrag = true;

		this.sourceDocument = doc;
		this.primaryDraggedLeaf = draggedLeaf;
		this.draggedLeavesInDomOrder = leavesInOrder;
		this.originalTabPositions = this.captureOriginalTabPositions(leavesInOrder);
	}

	private onDragEnd(event: DragEvent) {
		if (!this.isMultiDragActive) {
			this.suppressClicksDuringDrag = false;
			return;
		}

		const effect = event.dataTransfer?.dropEffect ?? "";
		if (effect !== "move" && effect !== "none") {
			this.resetDragState();
			return;
		}

		const dragged = this.primaryDraggedLeaf;
		const snapshot = this.draggedLeavesInDomOrder.slice();
		const restore = this.originalTabPositions.slice();
		const dragDoc = this.sourceDocument;

		if (!dragged || snapshot.length < 2) {
			this.resetDragState();
			return;
		}

		this.finalizeMultiDrag(dragged, snapshot, restore, dragDoc);
	}

	private captureOriginalTabPositions(leavesInOrder: WorkspaceLeaf[]): OriginalTabPosition[] {
		return leavesInOrder.map((leaf) => {
			const parent = leaf.parent as WorkspaceTabs;
			const idx = parent ? Math.max(0, parent.children.indexOf(leaf)) : 0;
			return {leaf, parent, index: idx};
		});
	}

	private resetDragState() {
		this.isMultiDragActive = false;
		this.sourceDocument = null;
		this.primaryDraggedLeaf = null;
		this.draggedLeavesInDomOrder = [];
		this.originalTabPositions = [];
		this.suppressClicksDuringDrag = false;
	}

	private finalizeMultiDrag(
		dragged: WorkspaceLeaf,
		snapshot: WorkspaceLeaf[],
		restore: OriginalTabPosition[],
		dragDoc: Document | null
	) {
		const targetTabs = dragged.parent as WorkspaceTabs;

		if (!targetTabs) {
			this.restoreLeavesToOriginalPositions(restore);
			this.resetDragState();
			return;
		}

		try {
			this.reinsertDraggedSelectionAroundPrimaryTab(targetTabs, snapshot, dragged);

			const destinationDoc = dragged.getContainer().doc ?? dragDoc ?? activeDocument;
			this.services.selection.setDocumentSelection(destinationDoc, snapshot);
		} catch (e) {
			this.services.logger.logWarn(`${this.finalizeMultiDrag.name} failed`, e);
			this.restoreLeavesToOriginalPositions(restore);
		} finally {
			this.resetDragState();
		}
	}

	private restoreLeavesToOriginalPositions(restore: OriginalTabPosition[]) {
		const byParent = new Map<WorkspaceTabs, Array<{ leaf: WorkspaceLeaf; index: number }>>();

		for (const entry of restore) {
			const parent = entry.parent;
			if (!parent)
				continue;

			if (!byParent.has(parent))
				byParent.set(parent, []);
			byParent.get(parent)!.push({leaf: entry.leaf, index: entry.index});
		}

		for (const [parent, entries] of byParent.entries()) {
			entries.sort((a, b) => a.index - b.index);

			for (const {leaf, index} of entries) {
				const currentParent = leaf.parent as WorkspaceTabs;

				if (currentParent)
					this.tryRemoveChild(currentParent, leaf, "restore");

				const safeIndex = Math.max(0, Math.min(index, parent.children.length));
				this.tryInsertChild(parent, safeIndex, leaf, "restore");
			}

			parent.updateSlidingTabs?.();
		}
	}

	private tryRemoveChild(parent: WorkspaceTabs, leaf: WorkspaceLeaf, context: string): boolean {
		try {
			parent.removeChild(leaf);
			return true;
		} catch (e) {
			this.services.logger.logWarn(`${context}: removeChild failed`, e);
			return false;
		}
	}

	private tryInsertChild(parent: WorkspaceTabs, index: number, leaf: WorkspaceLeaf, context: string): boolean {
		try {
			parent.insertChild(index, leaf);
			return true;
		} catch (e) {
			this.services.logger.logWarn(`${context}: insertChild failed`, e);
			return false;
		}
	}

	private reinsertDraggedSelectionAroundPrimaryTab(targetTabs: WorkspaceTabs, snapshotInOrder: WorkspaceLeaf[], dragged: WorkspaceLeaf) {
		const draggedOffset = snapshotInOrder.indexOf(dragged);
		if (draggedOffset < 0)
			return;

		const before = snapshotInOrder.slice(0, draggedOffset);
		const after = snapshotInOrder.slice(draggedOffset + 1);

		const nonDragged = [...before, ...after];
		if (nonDragged.length === 0)
			return;

		this.tabActions.detachTabsFromParents(nonDragged);

		let draggedIndex = targetTabs.children.indexOf(dragged);
		if (draggedIndex < 0)
			draggedIndex = targetTabs.children.length - 1;

		let insertAt = draggedIndex;
		for (const leaf of before) {
			const safeIndex = Math.max(0, Math.min(insertAt, targetTabs.children.length));
			this.tryInsertChild(targetTabs, safeIndex, leaf, "restore");
			insertAt++;
			draggedIndex++;
		}

		insertAt = draggedIndex + 1;
		for (const leaf of after) {
			const safeIndex = Math.max(0, Math.min(insertAt, targetTabs.children.length));
			this.tryInsertChild(targetTabs, safeIndex, leaf, "restore");
			insertAt++;
		}

		targetTabs.updateSlidingTabs?.();
		targetTabs.selectTab?.(dragged, false);
	}

	private getSelectedLeavesInDomOrder(
		group: HTMLElement,
		selectedLeaves: WorkspaceLeaf[],
		resolveLeaf: (h: HTMLElement) => WorkspaceLeaf | null
	): WorkspaceLeaf[] {
		const selected = new Set(selectedLeaves);
		const headers = listTabHeadersInGroup(group);

		const out: WorkspaceLeaf[] = [];
		const seen = new Set<WorkspaceLeaf>();

		for (const header of headers) {
			const leaf = resolveLeaf(header);
			if (!leaf)
				continue;
			if (!selected.has(leaf))
				continue;
			if (seen.has(leaf))
				continue;
			seen.add(leaf);
			out.push(leaf);
		}
		return out;
	}
}
