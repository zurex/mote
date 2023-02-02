import { IActionViewItem } from 'mote/base/browser/ui/actionbar/actionbar';
import { IActionViewItemOptions } from 'mote/base/browser/ui/actionbar/actionViewItems';
import { AnchorAlignment, AnchorAxisAlignment } from 'mote/base/browser/ui/contextview/contextview';
import { IAction, IActionRunner } from 'mote/base/common/actions';
import { ResolvedKeybinding } from 'mote/base/common/keybindings';

export interface IContextMenuEvent {
	readonly shiftKey?: boolean;
	readonly ctrlKey?: boolean;
	readonly altKey?: boolean;
	readonly metaKey?: boolean;
}

export interface IContextMenuDelegate {
	getActions(): readonly IAction[];
	getAnchor(): HTMLElement | { x: number; y: number; width?: number; height?: number };
	getActionViewItem?(action: IAction, options: IActionViewItemOptions): IActionViewItem | undefined;
	getActionsContext?(event?: IContextMenuEvent): unknown;
	getKeyBinding?(action: IAction): ResolvedKeybinding | undefined;
	getMenuClassName?(): string;
	onHide?(didCancel: boolean): void;
	actionRunner?: IActionRunner;
	autoSelectFirstItem?: boolean;
	anchorAlignment?: AnchorAlignment;
	anchorAxisAlignment?: AnchorAxisAlignment;
	domForShadowRoot?: HTMLElement;
}

export interface IContextMenuProvider {
	showContextMenu(delegate: IContextMenuDelegate): void;
}
