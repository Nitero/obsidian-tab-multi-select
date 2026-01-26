import {WorkspaceLeaf, WorkspaceTabs} from "obsidian";

export type CloseEntry = { parent: WorkspaceTabs | null; index: number };
export type CloseTransaction = { entries: CloseEntry[] };

export class CloseHistory {
	private history: CloseTransaction[] = [];

	private explicitTransactionDepth = 0;
	private currentExplicitTransaction: CloseTransaction | null = null;

	private batchUndoInProgress = false;

	setBatchUndoInProgress(inProgress: boolean) {
		this.batchUndoInProgress = inProgress;
	}

	isBatchUndoInProgress() {
		return this.batchUndoInProgress;
	}

	isInExplicitTransaction() {
		return this.explicitTransactionDepth > 0 || this.currentExplicitTransaction != null;
	}

	beginExplicitTransaction() {
		this.explicitTransactionDepth++;
		if (this.explicitTransactionDepth === 1) {
			this.currentExplicitTransaction = {entries: []};
		}
	}

	commitExplicitTransaction() {
		if (this.explicitTransactionDepth === 0)
			return;

		this.explicitTransactionDepth--;
		if (this.explicitTransactionDepth !== 0)
			return;

		const transaction = this.currentExplicitTransaction;
		this.currentExplicitTransaction = null;

		if (transaction && transaction.entries.length > 0)
			this.history.push(transaction);
	}

	recordEntry(parent: WorkspaceTabs | null, index: number) {
		if (this.currentExplicitTransaction) {
			this.currentExplicitTransaction.entries.push({parent, index});
			return;
		}
		this.history.push({entries: [{parent, index}]});
	}

	recordLeafClose(leaf: WorkspaceLeaf) {
		const parent = leaf.parent as WorkspaceTabs;
		const index = parent ? Math.max(0, parent.children.indexOf(leaf)) : 0;
		this.recordEntry(parent, index);
	}

	popLastTransaction(): CloseTransaction | undefined {
		return this.history.pop();
	}

	clear() {
		this.history = [];
		this.explicitTransactionDepth = 0;
		this.currentExplicitTransaction = null;
		this.batchUndoInProgress = false;
	}
}
