import { IMenuLike, IMenuOptions, Menu } from 'mote/base/browser/ui/menu/menu';
import { BrowserContextViewBasedService } from 'mote/platform/contextview/browser/contextViewBasedService';
import { IAction, Separator } from 'mote/base/common/actions';
import { IContextMenuMenuDelegate, IContextMenuService, IContextViewService } from 'mote/platform/contextview/browser/contextView';
import { IContextMenuDelegate } from 'mote/base/browser/contextmenu';
import { Disposable } from 'mote/base/common/lifecycle';
import { ContextMenuHandler } from 'mote/platform/contextview/browser/contextMenuHandler';
import { Emitter } from 'mote/base/common/event';
import { INotificationService } from 'mote/platform/notification/common/notification';
import { IContextKeyService } from 'mote/platform/contextkey/common/contextkey';
import { IKeybindingService } from 'mote/platform/keybinding/common/keybinding';
import { IMenuService, MenuId } from 'mote/platform/actions/common/actions';
import { ModifierKeyEmitter } from 'mote/base/browser/dom';
import { createAndFillInContextMenuActions } from 'mote/platform/actions/browser/menuEntryActionViewItem';

export interface IContextMenuHandlerOptions {
	blockMouse: boolean;
}

export class ContextMenuService extends Disposable implements IContextMenuService {

	declare readonly _serviceBrand: undefined;

	private _contextMenuHandler: ContextMenuHandler | undefined = undefined;
	private get contextMenuHandler(): ContextMenuHandler {
		if (!this._contextMenuHandler) {
			this._contextMenuHandler = new ContextMenuHandler(this.contextViewService, this.notificationService, this.keybindingService);
		}

		return this._contextMenuHandler;
	}

	private readonly _onDidShowContextMenu = this._store.add(new Emitter<void>());
	readonly onDidShowContextMenu = this._onDidShowContextMenu.event;

	private readonly _onDidHideContextMenu = this._store.add(new Emitter<void>());
	readonly onDidHideContextMenu = this._onDidHideContextMenu.event;

	constructor(
		//@ITelemetryService private readonly telemetryService: ITelemetryService,
		@INotificationService private readonly notificationService: INotificationService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
		@IMenuService private readonly menuService: IMenuService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
	) {
		super();
	}

	configure(options: IContextMenuHandlerOptions): void {
		this.contextMenuHandler.configure(options);
	}

	// ContextMenu

	showContextMenu(delegate: IContextMenuDelegate | IContextMenuMenuDelegate): void {

		delegate = ContextMenuMenuDelegate.transform(delegate, this.menuService, this.contextKeyService);

		this.contextMenuHandler.showContextMenu({
			...delegate,
			onHide: (didCancel) => {
				delegate.onHide?.(didCancel);

				this._onDidHideContextMenu.fire();
			}
		});
		ModifierKeyEmitter.getInstance().resetKeyStatus();
		this._onDidShowContextMenu.fire();
	}
}

export namespace ContextMenuMenuDelegate {

	function is(thing: IContextMenuDelegate | IContextMenuMenuDelegate): thing is IContextMenuMenuDelegate {
		return thing && (<IContextMenuMenuDelegate>thing).menuId instanceof MenuId;
	}

	export function transform(delegate: IContextMenuDelegate | IContextMenuMenuDelegate, menuService: IMenuService, globalContextKeyService: IContextKeyService): IContextMenuDelegate {
		if (!is(delegate)) {
			return delegate;
		}
		const { menuId, menuActionOptions, contextKeyService } = delegate;
		return {
			...delegate,
			getActions: () => {
				const target: IAction[] = [];
				if (menuId) {
					const menu = menuService.createMenu(menuId, contextKeyService ?? globalContextKeyService);
					createAndFillInContextMenuActions(menu, menuActionOptions, target);
					menu.dispose();
				}
				if (!delegate.getActions) {
					return target;
				} else {
					return Separator.join(delegate.getActions(), target);
				}
			}
		};
	}
}
