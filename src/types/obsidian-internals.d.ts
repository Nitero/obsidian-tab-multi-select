import "obsidian";
import type {Command} from "obsidian";

declare module "obsidian" {
	interface App {
		commands: {
			commands?: Record<string, Command>;
			executeCommandById?: (commandId: string) => boolean;
			executeCommand?: (command: { id: string }) => unknown;
		};
	}

	interface WorkspaceTabs {
		children: WorkspaceLeaf[];

		insertChild(index: number, leaf: WorkspaceLeaf): void;

		removeChild(leaf: WorkspaceLeaf): void;

		updateSlidingTabs?: () => void;
		selectTab?: (leaf: WorkspaceLeaf, pushHistory?: boolean) => void;
	}

	interface WorkspaceLeaf {
		tabHeaderEl?: HTMLElement;
	}
}

export {};
