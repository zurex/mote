import { IAction, IActionRunner } from 'mote/base/common/actions';

export interface IContextMenuEvent {
	readonly shiftKey?: boolean;
	readonly ctrlKey?: boolean;
	readonly altKey?: boolean;
	readonly metaKey?: boolean;
}

export interface IContextMenuDelegate {
	getActions(): readonly IAction[];
	getAnchor(): HTMLElement | { x: number; y: number; width?: number; height?: number };
	getMenuClassName?(): string;
	actionRunner?: IActionRunner;
	domForShadowRoot?: HTMLElement;
}

export interface IContextMenuProvider {
	showContextMenu(delegate: IContextMenuDelegate): void;
}
