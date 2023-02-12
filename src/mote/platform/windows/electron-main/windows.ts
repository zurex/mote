import { Event } from 'mote/base/common/event';
import { IAppWindow } from 'mote/platform/window/electron-main/window';
import { createDecorator } from 'mote/platform/instantiation/common/instantiation';
import { IOpenEmptyWindowOptions, IWindowOpenable } from 'mote/platform/window/common/window';
import { NativeParsedArgs } from 'mote/platform/environment/common/argv';
import { IProcessEnvironment } from 'mote/base/common/platform';

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

export interface IWindowsCountChangedEvent {
	readonly oldCount: number;
	readonly newCount: number;
}

export interface IBaseOpenConfiguration {
	readonly context: OpenContext;
	readonly contextWindowId?: number;
}

export interface IOpenConfiguration extends IBaseOpenConfiguration {
	readonly cli: NativeParsedArgs;

	readonly userEnv?: IProcessEnvironment;
	readonly urisToOpen?: IWindowOpenable[];
	readonly preferNewWindow?: boolean;
	readonly forceNewWindow?: boolean;
	readonly forceNewTabbedWindow?: boolean;
	readonly forceReuseWindow?: boolean;
	readonly forceEmpty?: boolean;

	/**
	 * The remote authority to use when windows are opened with either
	 * - no workspace (empty window)
	 * - a workspace that is neither `file://` nor `vscode-remote://`
	 */
	readonly remoteAuthority?: string;
	readonly forceProfile?: string;
	readonly forceTempProfile?: boolean;
}

export interface IOpenEmptyConfiguration extends IBaseOpenConfiguration { }


export interface IWindowsMainService {

	readonly onDidChangeWindowsCount: Event<IWindowsCountChangedEvent>;

	readonly onDidOpenWindow: Event<IAppWindow>;
	readonly onDidTriggerSystemContextMenu: Event<{ window: IAppWindow; x: number; y: number }>;
	readonly onDidDestroyWindow: Event<IAppWindow>;

	open(openConfig: IOpenConfiguration): Promise<IAppWindow[]>;
	openEmptyWindow(openConfig: IOpenEmptyConfiguration, options?: IOpenEmptyWindowOptions): Promise<IAppWindow[]>;

	sendToFocused(channel: string, ...args: any[]): void;

	getWindows(): IAppWindow[];
	getWindowCount(): number;

	getFocusedWindow(): IAppWindow | undefined;
	getLastActiveWindow(): IAppWindow | undefined;

	getWindowById(windowId: number): IAppWindow | undefined;
}

export const IWindowsMainService = createDecorator<IWindowsMainService>('windowsMainService');
