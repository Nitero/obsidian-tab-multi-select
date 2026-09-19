import {addIcon} from "obsidian";

const lucideIcon = (contents: string) => `
	<g
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		transform="scale(${100 / 24})"
	>
		${contents}
	</g>
`;


export class CustomLucideIcons {
	constructor() {
		addIcon(
			"pin-toggle",
			lucideIcon(`
				<path d="M12 17v5" />
				<path d="M13.5 2 L12.5 2" />
				<path d="M15 9 L15 8" />
				<path d="M17.724 5 A2 2 0 0 0 17.5 2.688" />
				<path d="m2 2 20 20" />
				<path d="M8.5 2 L8 2" />
				<path d="M9 9v1.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V16a1 1 0 001 1h11" />
			`),
		);
	}
}
