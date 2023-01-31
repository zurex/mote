import { createDecorator } from 'mote/platform/instantiation/common/instantiation';
import { IOpenEmptyWindowOptions, IOpenWindowOptions, IWindowOpenable } from 'mote/platform/window/common/window';

export const IHostService = createDecorator<IHostService>('hostService');

export interface IHostService {

	//#region Window

	/**
	 * Opens an empty window. The optional parameter allows to define if
	 * a new window should open or the existing one change to an empty.
	 */
	openWindow(options?: IOpenEmptyWindowOptions): Promise<void>;

	/**
	 * Opens the provided array of openables in a window with the provided options.
	 */
	openWindow(toOpen: IWindowOpenable[], options?: IOpenWindowOptions): Promise<void>;

	/**
	 * Switch between fullscreen and normal window.
	 */
	toggleFullScreen(): Promise<void>;

	//#endregion

	//#region Lifecycle

	/**
	 * Restart the entire application.
	 */
	restart(): Promise<void>;

	/**
	 * Reload the currently active window.
	 */
	reload(options?: { disableExtensions?: boolean }): Promise<void>;

	/**
	 * Attempt to close the active window.
	 */
	close(): Promise<void>;

	//#endregion
}
