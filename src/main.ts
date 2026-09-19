import {Plugin, WorkspaceWindow, App} from "obsidian";

import {SelectionStore} from "./selection/selectionStore";

import {CloseHistory} from "./undo/closeHistory";
import {DetachPatch} from "./undo/detachPatch";
import {UndoPatch} from "./undo/undoPatch";

import {DragController} from "./drag/dragController";
import {TabActions} from "./actions/tabActions";
import {ContextMenuController} from "./actions/contextMenu";
import {SelectionEventsController} from "./selection/selectionEvents";
import {Logger} from "./utils/logger";
import {ClosePatch} from "./nativeCommands/closePatch";
import {CloseOthersPatch} from "./nativeCommands/closeOthersPatch";
import {MoveToNewWindowPatch} from "./nativeCommands/moveToNewWindowPatch";
import {TogglePinPatch} from "./nativeCommands/togglePinPatch";
import {CustomLucideIcons} from "./utils/lucideIcons";


export type PluginServices = {
	app: App;
	selection: SelectionStore;
	closeHistory: CloseHistory;
	logger: Logger;
};

export default class MultiSelectTabsPlugin extends Plugin {
	private attachedDocs = new Set<Document>();
	private isUnloading = false;

	private services!: PluginServices;

	private detachPatch!: DetachPatch;
	private undoPatch!: UndoPatch;
	private closePatch!: ClosePatch;
	private closeOthersPatch!: CloseOthersPatch;
	private moveToNewWindowPatch!: MoveToNewWindowPatch;
	private togglePinPatch!: TogglePinPatch;

	private tabActions!: TabActions;
	private dragController!: DragController;
	private contextMenu!: ContextMenuController;
	private selectionEvents!: SelectionEventsController;

	onload() {
		this.isUnloading = false;

		const logger = new Logger();
		const selection = new SelectionStore();
		const closeHistory = new CloseHistory();

		this.services = {
			app: this.app,
			selection,
			closeHistory,
			logger,
		};

		this.detachPatch = new DetachPatch(this.services);
		this.undoPatch = new UndoPatch(this.services);

		this.tabActions = new TabActions(this.services);
		this.closePatch = new ClosePatch(this.services, this.tabActions);
		this.closeOthersPatch = new CloseOthersPatch(this.services, this.tabActions);
		this.moveToNewWindowPatch = new MoveToNewWindowPatch(this.services, this.tabActions);
		this.togglePinPatch = new TogglePinPatch(this.services, this.tabActions);
		this.dragController = new DragController(this.services, this.tabActions);

		new CustomLucideIcons();
		this.contextMenu = new ContextMenuController(this.services, this.tabActions);

		this.selectionEvents = new SelectionEventsController(
			this.services,
			this.dragController,
			this.tabActions,
		);

		this.attachKnownDocuments();
		this.app.workspace.onLayoutReady(() => this.attachKnownDocuments());
		this.registerEvent(
			this.app.workspace.on("layout-change", () => this.attachKnownDocuments())
		);
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => this.attachKnownDocuments())
		);
		this.registerEvent(
			this.app.workspace.on("window-open", (_win: WorkspaceWindow, w: Window) => {
				this.attach(w.document);
				this.attach(w.activeDocument);
			})
		);

		this.detachPatch.install();
		this.undoPatch.install();
		this.closePatch.install();
		this.closeOthersPatch.install();
		this.moveToNewWindowPatch.install();
		this.togglePinPatch.install();

		this.registerDomEvent(window, "blur", () => {
			const element = document.activeElement;

			if (!(element instanceof HTMLElement)) {
				return;
			}

			const isEditable =
				element.matches("input, textarea, [contenteditable='true']");

			if (!isEditable) {
				return;
			}

			const shouldBlur =
				element.closest(".metadata-container") !== null ||
				element.closest(".search-input-container") !== null ||
				element.closest(".document-search-container") !== null;

			if (shouldBlur) {
				element.blur();
			}
		});
	}

	onunload() {
		this.isUnloading = true;

		for (const doc of this.attachedDocs)
			this.services.selection.clearDocumentSelection(doc);

		this.attachedDocs.clear();

		this.services?.closeHistory.clear();

		this.togglePinPatch?.uninstall();
		this.moveToNewWindowPatch?.uninstall();
		this.closeOthersPatch?.uninstall();
		this.closePatch?.uninstall();
		this.detachPatch?.uninstall();
		this.undoPatch?.uninstall();
	}

	private attachKnownDocuments() {
		if (this.isUnloading)
			return;

		this.attach(document);
		this.attach(activeDocument);

		this.app.workspace.iterateAllLeaves((leaf) => {
			const leafDoc = leaf.tabHeaderEl?.ownerDocument ?? leaf.getContainer().doc;
			this.attach(leafDoc);
		});
	}

	private attach(doc: Document) {
		if (this.attachedDocs.has(doc))
			return;
		this.attachedDocs.add(doc);

		this.selectionEvents.registerForDocument(doc, this);

		this.dragController.registerForDocument(doc, this);
		this.contextMenu.registerForDocument(doc, this);
	}
}
