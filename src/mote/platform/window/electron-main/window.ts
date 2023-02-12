import { Event } from 'mote/base/common/event';
import { IDisposable } from 'mote/base/common/lifecycle';
import { INativeWindowConfiguration } from 'mote/platform/window/common/window';
import { BrowserWindow } from 'electron';
import { NativeParsedArgs } from 'mote/platform/environment/common/argv';
import { CancellationToken } from 'mote/base/common/cancellation';
import { IWorkspaceIdentifier } from 'mote/platform/workspace/common/workspace';

export interface IAppWindow extends IDisposable {

	readonly onWillLoad: Event<ILoadEvent>;

	readonly id: number;
	readonly win: BrowserWindow | null; /* `null` after being disposed */
	readonly config: INativeWindowConfiguration | undefined;

	readonly lastFocusTime: number;

	readonly isReady: boolean;
	ready(): Promise<IAppWindow>;
	setReady(): void;

	load(config: INativeWindowConfiguration, options?: { isReload?: boolean }): void;
	reload(cli?: NativeParsedArgs): void;

	send(channel: string, ...args: any[]): void;
	sendWhenReady(channel: string, token: CancellationToken, ...args: any[]): void;

	readonly isFullScreen: boolean;
	toggleFullScreen(): void;

	isMinimized(): boolean;

	close(): void;
}

export const enum LoadReason {

	/**
	 * The window is loaded for the first time.
	 */
	INITIAL = 1,

	/**
	 * The window is loaded into a different workspace context.
	 */
	LOAD,

	/**
	 * The window is reloaded.
	 */
	RELOAD
}

export const enum UnloadReason {

	/**
	 * The window is closed.
	 */
	CLOSE = 1,

	/**
	 * All windows unload because the application quits.
	 */
	QUIT,

	/**
	 * The window is reloaded.
	 */
	RELOAD,

	/**
	 * The window is loaded into a different workspace context.
	 */
	LOAD
}

export interface ILoadEvent {
	readonly workspace: IWorkspaceIdentifier | undefined;
	readonly reason: LoadReason;
}

export const enum WindowError {

	/**
	 * Maps to the `unresponsive` event on a `BrowserWindow`.
	 */
	UNRESPONSIVE = 1,

	/**
	 * Maps to the `render-process-gone` event on a `WebContents`.
	 */
	PROCESS_GONE = 2,

	/**
	 * Maps to the `did-fail-load` event on a `WebContents`.
	 */
	LOAD = 3
}
