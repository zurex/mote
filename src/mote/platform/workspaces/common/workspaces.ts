import { IWorkspaceIdentifier } from 'mote/platform/workspace/common/workspace';
import { URI } from 'mote/base/common/uri';
import { registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { createDecorator } from 'mote/platform/instantiation/common/instantiation';

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
	//addRecentlyOpened(recents: IRecent[]): Promise<void>;
	//removeRecentlyOpened(workspaces: URI[]): Promise<void>;
	//clearRecentlyOpened(): Promise<void>;
	//getRecentlyOpened(): Promise<IRecentlyOpened>;
}

class WorkspacesService implements IWorkspacesService {
	_serviceBrand: undefined;
	enterWorkspace(workspaceUri: URI): Promise<IEnterWorkspaceResult | undefined> {
		throw new Error('Method not implemented.');
	}
	createWorkspace(folders?: IWorkspaceFolderCreationData[] | undefined, remoteAuthority?: string | undefined): Promise<IWorkspaceIdentifier> {
		throw new Error('Method not implemented.');
	}
	deleteWorkspace(workspace: IWorkspaceIdentifier): Promise<void> {
		throw new Error('Method not implemented.');
	}
	getWorkspaceIdentifier(workspaceUri: URI): Promise<IWorkspaceIdentifier> {
		throw new Error('Method not implemented.');
	}
}

registerSingleton(IWorkspacesService, WorkspacesService);
