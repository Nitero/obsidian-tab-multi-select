import {Notice, WorkspaceLeaf, WorkspaceTabs} from "obsidian";
import {MOVE_TO_NEW_WINDOW_COMMAND_ID} from "../core/constants";
import {PluginServices} from "../main";
import {executeCommand} from "../utils/commandRunner";

const RESOLVE_FAILED_NOTICE = "Couldn't resolve selected tabs to leaves.";

export class TabActions {
	constructor(private services: PluginServices) {
	}

	pinTabs(leaves: WorkspaceLeaf[]) {
		this.setPinned(leaves, true, "Pinned");
	}

	unpinTabs(leaves: WorkspaceLeaf[]) {
		this.setPinned(leaves, false, "Unpinned");
	}

	private setPinned(leaves: WorkspaceLeaf[], pinned: boolean, noticePrefix: string) {
		if (leaves.length === 0) {
			new Notice(RESOLVE_FAILED_NOTICE);
			return;
		}

		for (const leaf of leaves)
			leaf.setPinned(pinned);

		new Notice(`${noticePrefix} ${leaves.length} tab(s).`);
	}

	moveTabsToNewWindow(leaves: WorkspaceLeaf[]) {
		if (leaves.length === 0) {
			new Notice(RESOLVE_FAILED_NOTICE);
			return;
		}

		const first = leaves[0];
		if (!first) {
			new Notice(RESOLVE_FAILED_NOTICE);
			return;
		}

		if (leaves.length === 1) {
			this.moveSingleTabToNewWindow(first);
			return;
		}

		const rest = leaves.slice(1);

		this.moveFirstSelectedTabToNewWindow(first);
		this.moveRemainingSelectedTabsToNewWindow(first, rest, leaves);
	}

	private moveFirstSelectedTabToNewWindow(first: WorkspaceLeaf) {
		this.services.app.workspace.setActiveLeaf(first, {focus: true});
		executeCommand(MOVE_TO_NEW_WINDOW_COMMAND_ID, this.services.app, this.services.logger);
	}

	private moveRemainingSelectedTabsToNewWindow(first: WorkspaceLeaf, rest: WorkspaceLeaf[], all: WorkspaceLeaf[]) {
		const targetTabs = first.parent as WorkspaceTabs;
		if (!targetTabs) {
			new Notice("Couldn't find destination tab group in the new window.");
			return;
		}

		this.detachTabsFromParents(rest);

		let firstIndex = targetTabs.children.indexOf(first);
		if (firstIndex < 0)
			firstIndex = targetTabs.children.length - 1;

		try {
			let insertAt = firstIndex + 1;
			for (const leaf of rest) {
				const safeIndex = Math.max(0, Math.min(insertAt, targetTabs.children.length));
				targetTabs.insertChild(safeIndex, leaf);
				insertAt++;
			}

			targetTabs.updateSlidingTabs?.();
			targetTabs.selectTab?.(first, false);

			const destinationDoc = first.tabHeaderEl?.ownerDocument ?? activeDocument;
			this.services.selection.setDocumentSelection(destinationDoc, all);

			new Notice(`Moved ${all.length} tab(s) to a new window.`);
		} catch (e) {
			this.services.logger.logWarn(`${this.moveRemainingSelectedTabsToNewWindow.name} failed`, e);
			new Notice("Failed to move tabs.");
		}
	}

	private moveSingleTabToNewWindow(leaf: WorkspaceLeaf) {
		try {
			this.services.app.workspace.setActiveLeaf(leaf, {focus: true});
			const ok = executeCommand(MOVE_TO_NEW_WINDOW_COMMAND_ID, this.services.app, this.services.logger);
			new Notice(ok ? "Moved tab to a new window." : "Couldn't move tab to a new window.");
		} catch (e) {
			this.services.logger.logWarn(`${this.moveSingleTabToNewWindow.name} failed`, e);
			new Notice("Couldn't move tab to a new window.");
		}
	}

	closeTabs(leaves: WorkspaceLeaf[], clearSelection: boolean = true) {
		let closed = 0;

		this.services.closeHistory.beginExplicitTransaction();
		try {
			for (const leaf of leaves) {
				if (!leaf)
					continue;

				try {
					const parent = leaf.parent as WorkspaceTabs;
					const index = parent ? Math.max(0, parent.children.indexOf(leaf)) : 0;

					this.services.closeHistory.recordEntry(parent, index);

					leaf.detach();
					closed++;
				} catch (e) {
					this.services.logger.logWarn("Failed to detach leaf", e);
				}
			}
		} finally {
			this.services.closeHistory.commitExplicitTransaction();
		}

		if (clearSelection) {
			const docs = new Set<Document>();
			for (const leaf of leaves) {
				const doc = leaf.getContainer().doc;
				if (doc)
					docs.add(doc);
			}
			if (docs.size === 0) docs.add(document);

			for (const doc of docs)
				this.services.selection.clearDocumentSelection(doc);
		}

		new Notice(closed > 0 ? `Closed ${closed} tab(s).` : `Couldn't resolve selected tabs to leaves.`);
	}

	detachTabsFromParents(leaves: WorkspaceLeaf[]) {
		const leavesByParent = new Map<WorkspaceTabs, WorkspaceLeaf[]>();

		for (const leaf of leaves) {
			const parent = leaf.parent as WorkspaceTabs;
			if (!parent)
				continue;

			if (!leavesByParent.has(parent)) leavesByParent.set(parent, []);
			leavesByParent.get(parent)!.push(leaf);
		}

		for (const [parent, groupLeaves] of leavesByParent.entries()) {
			const leavesDescending = groupLeaves
				.map((leaf) => ({leaf, idx: parent.children.indexOf(leaf)}))
				.filter((x) => x.idx >= 0)
				.sort((a, b) => b.idx - a.idx)
				.map((x) => x.leaf);

			for (const leaf of leavesDescending) {
				try {
					parent.removeChild(leaf);
				} catch (e) {
					this.services.logger.logWarn(`${this.detachTabsFromParents.name} failed`, e);
				}
			}

			parent.updateSlidingTabs?.();
		}
	}

}
