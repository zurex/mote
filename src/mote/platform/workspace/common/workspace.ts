import SpaceStore from 'mote/platform/store/common/spaceStore';
import { Event } from 'mote/base/common/event';
import { URI } from 'mote/base/common/uri';
import { createDecorator } from 'mote/platform/instantiation/common/instantiation';

export const enum WorkbenchState {
	/** Current workbench is empty */
	EMPTY = 1,
	/** The workbench only shows pages */
	PAGE,
	WORKSPACE,
}

export interface IWorkspacePage {

	/**
	 * The associated URI for this workspace page.
	 */
	readonly uri: URI;

	/**
	 * The name of this workspace page. Defaults to
	 * the basename of its [uri-path](#Uri.path)
	 */
	readonly name: string;

	/**
	 * The id of this workspace page.
	 */
	readonly id: string;
}

export interface IWorkspace {
	/**
	 * the unique identifier of the workspace.
	 */
	readonly id: string;

	/**
	 * Pages in the workspace.
	 */
	readonly pages: IWorkspacePage[];
}

export interface IBaseWorkspaceIdentifier {

	/**
	 * Every workspace (multi-root, single folder or empty)
	 * has a unique identifier. It is not possible to open
	 * a workspace with the same `id` in multiple windows
	 */
	readonly id: string;
}

/**
 * A multi-root workspace identifier is a path to a workspace file + id.
 */
export interface IWorkspaceIdentifier extends IBaseWorkspaceIdentifier {

	/**
	 * Workspace config file path as `URI`.
	 */
	configPath: URI;
}

export type IAnyWorkspaceIdentifier = IWorkspaceIdentifier;

export const IWorkspaceContextService = createDecorator<IWorkspaceContextService>('contextService');

export interface IWorkspaceContextService {

	readonly _serviceBrand: undefined;

	/**
	 * An event which fires on workbench state changes.
	 */
	readonly onDidChangeWorkbenchState: Event<WorkbenchState>;

	/**
	 * An event which fires on workspace name changes.
	 */
	readonly onDidChangeWorkspaceName: Event<void>;

	/**
	 * An event which fires on workspace pages change.
	 */
	readonly onDidChangeWorkspacePages: Event<void>;

	/**
	 * An event which fires on workspace pages change.
	 */
	readonly onDidChangeWorkspace: Event<void>;

	/**
	 * Provides access to the workspace object the window is running with.
	 * Use `getCompleteWorkspace` to get complete workspace object.
	 */
	getWorkspace(): IWorkspace;

	enterWorkspace(spaceId: string): void;

	createWorkspace(userId: string, spaceName: string): void;

	getSpaceStore(): SpaceStore | undefined;

	getSpaceStores(): SpaceStore[];
}
