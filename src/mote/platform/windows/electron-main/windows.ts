import { IAppWindow } from "mote/platform/window/electron-main/window";
import { createDecorator } from "mote/platform/instantiation/common/instantiation";

export const enum OpenContext {

	// opening when running from the command line
	CLI,

	// macOS only: opening from the dock (also when opening files to a running instance from desktop)
	DOCK,

	// opening from the main application window
	MENU,

	// opening from a file or folder dialog
	DIALOG,

	// opening from the OS's UI
	DESKTOP,

	// opening through the API
	API
}

export interface IBaseOpenConfiguration {
	readonly context: OpenContext;
	readonly contextWindowId?: number;
}

export interface IOpenConfiguration extends IBaseOpenConfiguration {

}

export interface IWindowsMainService {

	open(openConfig: IOpenConfiguration): IAppWindow[];

	sendToFocused(channel: string, ...args: any[]): void;
}

export const IWindowsMainService = createDecorator<IWindowsMainService>('windowsMainService');
