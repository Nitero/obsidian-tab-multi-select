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


export type PluginServices = {
	app: App;
	selection: SelectionStore;
	closeHistory: CloseHistory;
	logger: Logger;
};

export default class MultiSelectTabsPlugin extends Plugin {
	private attachedDocs = new Set<Document>();

	private services: PluginServices;

	private detachPatch: DetachPatch;
	private undoPatch: UndoPatch;

	private tabActions: TabActions;
	private dragController: DragController;
	private contextMenu: ContextMenuController;
	private selectionEvents: SelectionEventsController;

	async onload() {
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
		this.dragController = new DragController(this.services, this.tabActions);

		this.contextMenu = new ContextMenuController(this.services, this.tabActions);

		this.selectionEvents = new SelectionEventsController(
			this.services,
			this.dragController,
			this.tabActions,
		);

		this.attach(document);
		this.registerEvent(
			this.app.workspace.on("window-open", (_win: WorkspaceWindow, w: Window) => {
				this.attach(w.document);
			})
		);

		this.detachPatch.install();
		this.undoPatch.install();
	}

	onunload() {
		for (const doc of this.attachedDocs)
			this.services.selection.clearDocumentSelection(doc);

		this.attachedDocs.clear();

		this.services?.closeHistory.clear();

		this.detachPatch?.uninstall();
		this.undoPatch?.uninstall();
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
