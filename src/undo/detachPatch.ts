import {WorkspaceLeaf} from "obsidian";
import {PluginServices} from "../main";
import {patchMethod} from "../utils/patchUtils";

export class DetachPatch {
	private unpatch: (() => void) | null = null;
	private retryTimer: number | null = null;

	constructor(private services: PluginServices) {
	}

	install() {
		if (this.unpatch)
			return;
		this.tryPatch();
	}

	uninstall() {
		if (this.retryTimer != null) {
			window.clearTimeout(this.retryTimer);
			this.retryTimer = null;
		}
		this.unpatch?.();
		this.unpatch = null;
	}

	private tryPatch() {
		let anyLeaf: WorkspaceLeaf | null = null;
		this.services.app.workspace.iterateAllLeaves((leaf) => {
			if (!anyLeaf)
				anyLeaf = leaf;
		});

		if (!anyLeaf) {
			this.retryTimer = window.setTimeout(() => this.tryPatch(), 0);
			return;
		}

		const proto = Object.getPrototypeOf(anyLeaf) as WorkspaceLeaf;
		if (typeof proto.detach !== "function") {
			this.services.logger.logWarn(
				"Could not patch WorkspaceLeaf.detach; native closes won't be tracked."
			);
			return;
		}

		const {closeHistory, logger} = this.services;

		this.unpatch = patchMethod(proto, "detach", (orig) => {
			return function patchedDetach(this: WorkspaceLeaf, ...args: []) {
				if (!closeHistory.isBatchUndoInProgress() && !closeHistory.isInExplicitTransaction()) {
					try {
						closeHistory.recordLeafClose(this);
					} catch (e) {
						logger.logWarn("recordLeafClose failed", e);
					}
				}
				return orig.apply(this, args);
			};
		});
	}
}
