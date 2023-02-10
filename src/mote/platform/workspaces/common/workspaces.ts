import { IWorkspaceIdentifier } from 'mote/platform/workspace/common/workspace';
import { URI } from 'mote/base/common/uri';
import { registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { createDecorator } from 'mote/platform/instantiation/common/instantiation';
import { ILogService } from 'mote/platform/log/common/log';

export const IWorkspacesService = createDecorator<IWorkspacesService>('workspacesService');

export interface IEnterWorkspaceResult {
	readonly workspace: IWorkspaceIdentifier;
	readonly backupPath?: string;
}

export interface IWorkspaceFolderCreationData {
	readonly uri: URI;
	readonly name?: string;
}

export interface IWorkspacesService {

	readonly _serviceBrand: undefined;

	// Workspaces Management
	enterWorkspace(workspaceUri: URI): Promise<IEnterWorkspaceResult | undefined>;
	createWorkspace(folders?: IWorkspaceFolderCreationData[], remoteAuthority?: string): Promise<IWorkspaceIdentifier>;
	deleteWorkspace(workspace: IWorkspaceIdentifier): Promise<void>;
	getWorkspaceIdentifier(workspaceUri: URI): Promise<IWorkspaceIdentifier>;

	// Workspaces History
	//readonly onDidChangeRecentlyOpened: Event<void>;
	addRecentlyOpened(recents: IRecent[]): Promise<void>;
	//removeRecentlyOpened(workspaces: URI[]): Promise<void>;
	//clearRecentlyOpened(): Promise<void>;
	getRecentlyOpened(): Promise<IRecentlyOpened>;
}

//#region Workspaces Recently Opened

export interface IRecentlyOpened {
	workspaces: Array<IRecentWorkspace>;
	pages: IRecentPage[];
}

export type IRecent = IRecentWorkspace | IRecentPage;

export interface IRecentWorkspace {
	readonly workspace: IWorkspaceIdentifier;
	label?: string;
	readonly remoteAuthority?: string;
}

export interface IRecentPage {
	readonly pageUri: URI;
	label?: string;
	readonly remoteAuthority?: string;
}

export function isRecentWorkspace(curr: IRecent): curr is IRecentWorkspace {
	return curr.hasOwnProperty('workspace');
}

export function isRecentPage(curr: IRecent): curr is IRecentPage {
	return curr.hasOwnProperty('pageUri');
}

//#endregion

//#region Workspace Storage

interface ISerializedRecentWorkspace {
	readonly workspace: {
		id: string;
		configPath: string;
	};
	readonly label?: string;
	readonly remoteAuthority?: string;
}

interface ISerializedRecentPage {
	readonly pageUri: string;
	readonly label?: string;
	readonly remoteAuthority?: string;
}

interface ISerializedRecentlyOpened {
	readonly entries: Array<ISerializedRecentWorkspace | ISerializedRecentPage>; // since 1.55
}

export type RecentlyOpenedStorageData = object;

function isSerializedRecentWorkspace(data: any): data is ISerializedRecentWorkspace {
	return data.workspace && typeof data.workspace === 'object' && typeof data.workspace.id === 'string' && typeof data.workspace.configPath === 'string';
}

function isSerializedRecentFile(data: any): data is ISerializedRecentPage {
	return typeof data.pageUri === 'string';
}

export function restoreRecentlyOpened(data: RecentlyOpenedStorageData | undefined, logService: ILogService): IRecentlyOpened {
	const result: IRecentlyOpened = { workspaces: [], pages: [] };
	if (data) {
		const restoreGracefully = function <T>(entries: T[], onEntry: (entry: T, index: number) => void) {
			for (let i = 0; i < entries.length; i++) {
				try {
					onEntry(entries[i], i);
				} catch (e) {
					logService.warn(`Error restoring recent entry ${JSON.stringify(entries[i])}: ${e.toString()}. Skip entry.`);
				}
			}
		};

		const storedRecents = data as ISerializedRecentlyOpened;
		if (Array.isArray(storedRecents.entries)) {
			restoreGracefully(storedRecents.entries, entry => {
				const label = entry.label;
				const remoteAuthority = entry.remoteAuthority;

				if (isSerializedRecentWorkspace(entry)) {
					result.workspaces.push({ label, remoteAuthority, workspace: { id: entry.workspace.id, configPath: URI.parse(entry.workspace.configPath) } });
				} else if (isSerializedRecentFile(entry)) {
					result.pages.push({ label, remoteAuthority, pageUri: URI.parse(entry.pageUri) });
				}
			});
		}
	}

	return result;
}

//#endregion
