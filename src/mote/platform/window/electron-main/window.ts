import { IDisposable } from 'mote/base/common/lifecycle';
import { INativeWindowConfiguration } from 'mote/platform/window/common/window';
import { BrowserWindow } from 'electron';
import { NativeParsedArgs } from 'mote/platform/environment/common/argv';

export interface IAppWindow extends IDisposable {

	onWillLoad(arg0: (e: any) => void): any;


	readonly id: number;
	readonly win: BrowserWindow | null; /* `null` after being disposed */

	readonly isReady: boolean;

	load(config: INativeWindowConfiguration, options?: { isReload?: boolean }): void;
	reload(cli?: NativeParsedArgs): void;

	send(channel: string, ...args: any[]): void;

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
