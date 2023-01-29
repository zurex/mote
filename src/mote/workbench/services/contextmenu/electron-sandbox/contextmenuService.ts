/* eslint-disable code-no-unexternalized-strings */
import { IContextMenuDelegate } from "mote/base/browser/contextmenu";
import { IContextMenuService } from "mote/platform/contextview/browser/contextView";
import { Emitter } from "mote/base/common/event";
import { Disposable } from "mote/base/common/lifecycle";
import { registerSingleton } from "mote/platform/instantiation/common/extensions";

export class NativeContextMenuService extends Disposable implements IContextMenuService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidShowContextMenu = new Emitter<void>();
	readonly onDidShowContextMenu = this._onDidShowContextMenu.event;

	private readonly _onDidHideContextMenu = new Emitter<void>();
	readonly onDidHideContextMenu = this._onDidHideContextMenu.event;


	showContextMenu(delegate: IContextMenuDelegate): void {
		this._onDidShowContextMenu.fire();
	}
}

registerSingleton(IContextMenuService, NativeContextMenuService, true);
