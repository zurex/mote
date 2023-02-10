import { createDecorator } from 'mote/platform/instantiation/common/instantiation';
import { Event } from 'mote/base/common/event';
import { IDisposable } from 'mote/base/common/lifecycle';
import { IContextMenuDelegate } from 'mote/base/browser/contextmenu';
import { AnchorAlignment, AnchorAxisAlignment, IContextViewProvider } from 'mote/base/browser/ui/contextview/contextview';
import { IMenuActionOptions, MenuId } from 'mote/platform/actions/common/actions';
import { IContextKeyService } from 'mote/platform/contextkey/common/contextkey';
import { IAction } from 'mote/base/common/actions';

export const IContextViewService = createDecorator<IContextViewService>('contextViewService');

export interface IContextViewService extends IContextViewProvider {

	readonly _serviceBrand: undefined;

	showContextView(delegate: IContextViewDelegate, container?: HTMLElement, shadowRoot?: boolean): IDisposable;
	hideContextView(data?: any): void;
	getContextViewElement(): HTMLElement;
	layout(): void;
	anchorAlignment?: AnchorAlignment;
}

export interface IContextViewDelegate {

	canRelayout?: boolean; // Default: true

	getAnchor(): HTMLElement | { x: number; y: number; width?: number; height?: number };
	render(container: HTMLElement): IDisposable;
	onDOMEvent?(e: any, activeElement: HTMLElement): void;
	onHide?(data?: any): void;
	focus?(): void;
	anchorAlignment?: AnchorAlignment;
	anchorAxisAlignment?: AnchorAxisAlignment;
}

export const IContextMenuService = createDecorator<IContextMenuService>('contextMenuService');

export interface IContextMenuService {

	readonly _serviceBrand: undefined;

	readonly onDidShowContextMenu: Event<void>;
	readonly onDidHideContextMenu: Event<void>;

	showContextMenu(delegate: IContextMenuDelegate | IContextMenuMenuDelegate): void;
}

export type IContextMenuMenuDelegate = {
	/**
	 * The MenuId that should be used to populate the context menu.
	 */
	menuId?: MenuId;
	/**
	 * Optional options how menu actions are invoked
	 */
	menuActionOptions?: IMenuActionOptions;
	/**
	 * Optional context key service which drives the given menu
	 */
	contextKeyService?: IContextKeyService;

	/**
	 * Optional getter for extra actions. They will be prepended to the menu actions.
	 */
	getActions?(): IAction[];
} & Omit<IContextMenuDelegate, 'getActions'>;
