import {WorkspaceLeaf, WorkspaceTabs} from "obsidian";

export type CloseEntry = { parent: WorkspaceTabs | null; index: number };
export type CloseTransaction = {
	entries: CloseEntry[];
	replayInRecordedOrder?: boolean;
};

export class CloseHistory {
	private history: CloseTransaction[] = [];

	private explicitTransactionDepth = 0;
	private currentExplicitTransaction: CloseTransaction | null = null;
	private pendingImplicitTransaction: CloseTransaction | null = null;
	private pendingImplicitTimer: number | null = null;

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
		this.commitPendingImplicitTransaction();

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

		this.recordImplicitEntry(parent, index);
	}

	recordLeafClose(leaf: WorkspaceLeaf) {
		const parent = leaf.parent as WorkspaceTabs;
		const index = parent ? Math.max(0, parent.children.indexOf(leaf)) : 0;
		this.recordEntry(parent, index);
	}

	popLastTransaction(): CloseTransaction | undefined {
		this.commitPendingImplicitTransaction();
		return this.history.pop();
	}

	clear() {
		this.clearPendingImplicitTimer();
		this.history = [];
		this.explicitTransactionDepth = 0;
		this.currentExplicitTransaction = null;
		this.pendingImplicitTransaction = null;
		this.batchUndoInProgress = false;
	}

	private recordImplicitEntry(parent: WorkspaceTabs | null, index: number) {
		if (!this.pendingImplicitTransaction)
			this.pendingImplicitTransaction = {entries: [], replayInRecordedOrder: true};

		this.pendingImplicitTransaction.entries.push({parent, index});
		this.schedulePendingImplicitCommit();
	}

	private schedulePendingImplicitCommit() {
		if (this.pendingImplicitTimer != null)
			return;

		this.pendingImplicitTimer = window.setTimeout(() => {
			this.pendingImplicitTimer = null;
			this.commitPendingImplicitTransaction();
		}, 0);
	}

	private commitPendingImplicitTransaction() {
		this.clearPendingImplicitTimer();

		const transaction = this.pendingImplicitTransaction;
		this.pendingImplicitTransaction = null;

		if (transaction && transaction.entries.length > 0)
			this.history.push(transaction);
	}

	private clearPendingImplicitTimer() {
		if (this.pendingImplicitTimer == null)
			return;

		window.clearTimeout(this.pendingImplicitTimer);
		this.pendingImplicitTimer = null;
	}
}
