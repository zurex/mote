import { IMenuLike } from 'mote/base/browser/ui/menu/menu';
import { BrowserContextViewBasedService } from 'mote/platform/contextview/browser/contextViewBasedService';
import { IMenuOptions, Menu } from 'mote/base/browser/ui/menu/menu';
import { IAction } from 'mote/base/common/actions';
import { IContextMenuService } from './contextView';

export interface IContextMenuHandlerOptions {
	blockMouse: boolean;
}

export class BrowserContextMenuService extends BrowserContextViewBasedService implements IContextMenuService {

	declare readonly _serviceBrand: undefined;


	createMenu(container: HTMLElement, actions: readonly IAction[], options: IMenuOptions): IMenuLike {
		return new Menu(container, actions, options);
	}
}
