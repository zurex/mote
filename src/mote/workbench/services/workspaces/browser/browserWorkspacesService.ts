import { Emitter } from 'mote/base/common/event';
import { Disposable } from 'mote/base/common/lifecycle';
import { Schemas } from 'mote/base/common/network';
import { URI } from 'mote/base/common/uri';
import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { ILogService } from 'mote/platform/log/common/log';
import { IStorageService, StorageScope } from 'mote/platform/storage/common/storage';
import { IWorkspaceIdentifier } from 'mote/platform/workspace/common/workspace';
import { IEnterWorkspaceResult, IRecent, IRecentlyOpened, isRecentWorkspace, IWorkspaceFolderCreationData, IWorkspacesService, restoreRecentlyOpened } from 'mote/platform/workspaces/common/workspaces';

export class BrowserWorkspacesService extends Disposable implements IWorkspacesService {

	static readonly RECENTLY_OPENED_KEY = 'recently.opened';

	declare readonly _serviceBrand: undefined;

	private readonly _onRecentlyOpenedChange = this._register(new Emitter<void>());
	readonly onDidChangeRecentlyOpened = this._onRecentlyOpenedChange.event;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

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

	//#region Workspaces History

	addRecentlyOpened(recents: IRecent[]): Promise<void> {
		throw new Error('Method not implemented.');
	}

	async getRecentlyOpened(): Promise<IRecentlyOpened> {
		const recentlyOpenedRaw = this.storageService.get(BrowserWorkspacesService.RECENTLY_OPENED_KEY, StorageScope.APPLICATION);
		if (recentlyOpenedRaw) {
			return restoreRecentlyOpened(JSON.parse(recentlyOpenedRaw), this.logService);
		}

		return { workspaces: [], pages: [] };
	}

	//#endregion
}

registerSingleton(IWorkspacesService, BrowserWorkspacesService, InstantiationType.Delayed);
