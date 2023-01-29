import { IWorkspaceToOpen } from 'mote/platform/window/common/window';
import { IHostService } from 'mote/workbench/services/host/browser/host';
import { Disposable } from 'mote/base/common/lifecycle';
import { IBrowserWorkbenchEnvironmentService } from 'mote/workbench/services/environment/browser/environmentService';

/**
 * A workspace to open in the workbench can either be:
 * - a workspace file with 0-N folders (via `workspaceUri`)
 * - empty (via `undefined`)
 */
export type IWorkspace = IWorkspaceToOpen | undefined;

export interface IWorkspaceProvider {

	/**
	 * The initial workspace to open.
	 */
	readonly workspace: IWorkspace;

	/**
	 * Arbitrary payload from the `IWorkspaceProvider.open` call.
	 */
	readonly payload?: object;

	/**
	 * Asks to open a workspace in the current or a new window.
	 *
	 * @param workspace the workspace to open.
	 * @param options optional options for the workspace to open.
	 * - `reuse`: whether to open inside the current window or a new window
	 * - `payload`: arbitrary payload that should be made available
	 * to the opening window via the `IWorkspaceProvider.payload` property.
	 * @param payload optional payload to send to the workspace to open.
	 *
	 * @returns true if successfully opened, false otherwise.
	 */
	open(workspace: IWorkspace, options?: { reuse?: boolean; payload?: object }): Promise<boolean>;
}

export class BrowserHostService extends Disposable implements IHostService {
	private workspaceProvider!: IWorkspaceProvider;

	constructor(
		@IBrowserWorkbenchEnvironmentService environmentService: IBrowserWorkbenchEnvironmentService
	) {
		super();

		if (environmentService.options?.workspaceProvider) {
			this.workspaceProvider = environmentService.options.workspaceProvider as any;
		}
	}

	openWindow(toOpen: IWorkspaceToOpen, options?: any): Promise<void> {
		this.doOpen({ workspaceUri: toOpen.workspaceUri });
		return Promise.resolve();
	}

	private doOpen(workspace: IWorkspace) {
		this.workspaceProvider.open(workspace);
	}

	toggleFullScreen(): Promise<void> {
		throw new Error('Method not implemented.');
	}

	restart(): Promise<void> {
		throw new Error('Method not implemented.');
	}

	reload(options?: { disableExtensions?: boolean | undefined; } | undefined): Promise<void> {
		throw new Error('Method not implemented.');
	}

	close(): Promise<void> {
		throw new Error('Method not implemented.');
	}

}
