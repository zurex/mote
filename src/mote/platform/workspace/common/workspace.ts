import SpaceStore from 'mote/platform/store/common/spaceStore';
import { Event } from 'mote/base/common/event';
import { URI } from 'mote/base/common/uri';
import { createDecorator } from 'mote/platform/instantiation/common/instantiation';
import { basename } from 'mote/base/common/path';
import { TernarySearchTree } from 'mote/base/common/ternarySearchTree';
import { joinPath } from 'mote/base/common/resources';

export const enum WorkbenchState {
	/** Current workbench is empty */
	EMPTY = 1,
	/** The workbench only shows pages */
	PAGE,
	WORKSPACE,
}

export interface IWorkspacePageData {

	readonly id: string;

	/**
	 * The associated URI for this workspace folder.
	 */
	readonly uri: URI;

	/**
	 * The name of this workspace folder. Defaults to
	 * the basename of its [uri-path](#Uri.path)
	 */
	readonly name: string;

	/**
	 * The ordinal number of this workspace folder.
	 */
	readonly index: number;
}

export interface IWorkspacePage extends IWorkspacePageData {

	/**
	 * Given workspace folder relative path, returns the resource with the absolute path.
	 */
	toResource: (relativePath: string) => URI;
}

export interface IWorkspace {
	/**
	 * the unique identifier of the workspace.
	 */
	readonly id: string;

	/**
	 * Transient workspaces are meant to go away after being used
	 * once, e.g. a window reload of a transient workspace will
	 * open an empty window.
	 */
	readonly transient?: boolean;

	/**
	 * Pages in the workspace.
	 */
	readonly pages: IWorkspacePage[];

	/**
	 * the location of the workspace configuration
	 */
	readonly configuration?: URI | null;
}

/**
 * A single folder workspace identifier is a path to a folder + id.
 */
export interface ISinglePageWorkspaceIdentifier extends IBaseWorkspaceIdentifier {

	/**
	 * Folder path as `URI`.
	 */
	readonly uri: URI;
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

export interface IEmptyWorkspaceIdentifier extends IBaseWorkspaceIdentifier { }

export type IAnyWorkspaceIdentifier = IWorkspaceIdentifier | IEmptyWorkspaceIdentifier;

export const UNKNOWN_EMPTY_WINDOW_WORKSPACE: IEmptyWorkspaceIdentifier = { id: 'empty-window' };

export function toWorkspaceIdentifier(workspace: IWorkspace): IAnyWorkspaceIdentifier;
export function toWorkspaceIdentifier(backupPath: string | undefined, isExtensionDevelopment: boolean): IEmptyWorkspaceIdentifier;
export function toWorkspaceIdentifier(arg0: IWorkspace | string | undefined, isExtensionDevelopment?: boolean): IAnyWorkspaceIdentifier {

	// Empty workspace
	if (typeof arg0 === 'string' || typeof arg0 === 'undefined') {
		// With a backupPath, the basename is the empty workspace identifier
		if (typeof arg0 === 'string') {
			return {
				id: basename(arg0)
			};
		}

		return UNKNOWN_EMPTY_WINDOW_WORKSPACE;
	}

	const workspace = arg0;

	// Empty window
	return {
		id: workspace.id
	};
}

export function isWorkspaceIdentifier(obj: unknown): obj is IWorkspaceIdentifier {
	const workspaceIdentifier = obj as IWorkspaceIdentifier | undefined;

	return typeof workspaceIdentifier?.id === 'string' && URI.isUri(workspaceIdentifier.configPath);
}

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

export class Workspace implements IWorkspace {

	private _pages!: IWorkspacePage[];
	private _pagesMap: TernarySearchTree<URI, WorkspacePage> = TernarySearchTree.forUris<WorkspacePage>(this._ignorePathCasing, () => true);


	constructor(
		private _id: string,
		pages: IWorkspacePage[],
		private _transient: boolean,
		private _configuration: URI | null,
		private _ignorePathCasing: (key: URI) => boolean,
	) {
		this.pages = pages;
	}

	get id(): string {
		return this._id;
	}

	get transient(): boolean {
		return this._transient;
	}

	get configuration(): URI | null {
		return this._configuration;
	}

	get pages(): IWorkspacePage[] {
		return this._pages;
	}

	set pages(pages: IWorkspacePage[]) {
		this._pages = pages;
		this.updatePagessMap();
	}

	getPage(resource: URI): IWorkspacePage | null {
		if (!resource) {
			return null;
		}

		return this._pagesMap.findSubstr(resource) || null;
	}

	private updatePagessMap(): void {
		this._pagesMap = TernarySearchTree.forUris<WorkspacePage>(this._ignorePathCasing, () => true);
		for (const page of this.pages) {
			this._pagesMap.set(page.uri, page);
		}
	}

	toJSON(): IWorkspace {
		return { id: this.id, pages: this.pages, transient: this.transient, configuration: this.configuration };
	}
}

export class WorkspacePage implements IWorkspacePage {

	readonly id: string;
	readonly uri: URI;
	readonly name: string;
	readonly index: number;

	constructor(
		data: IWorkspacePageData,
	) {
		this.id = data.id;
		this.uri = data.uri;
		this.index = data.index;
		this.name = data.name;
	}

	toResource(relativePath: string): URI {
		return joinPath(this.uri, relativePath);
	}
}
