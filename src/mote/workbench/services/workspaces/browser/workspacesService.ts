import { Transaction } from 'mote/editor/common/core/transaction';
import { IWorkspace, IWorkspaceContextService, IWorkspacePage, WorkbenchState, Workspace, WorkspacePage } from 'mote/platform/workspace/common/workspace';
import { Emitter, Event } from 'mote/base/common/event';
import { Disposable } from 'mote/base/common/lifecycle';
import { EditOperation } from 'mote/editor/common/core/editOperation';
import { generateUuid } from 'mote/base/common/uuid';
import { Lodash } from 'mote/base/common/lodash';
import { IUserService } from 'mote/workbench/services/user/common/user';
import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { IEditorService } from 'mote/workbench/services/editor/common/editorService';
import { IUserProfile } from 'mote/platform/user/common/user';
import SpaceRootStore from 'mote/platform/store/common/spaceRootStore';
import SpaceStore from 'mote/platform/store/common/spaceStore';
import { IStoreService } from 'mote/platform/store/common/store';
import { IStorageService, StorageScope, StorageTarget } from 'mote/platform/storage/common/storage';
import { StoreStorageProvider } from 'mote/platform/store/common/storeStorageProvider';
import { URI } from 'mote/base/common/uri';

const CurrentSpaceIdStorageKey = 'CurrentSpaceIdStorageKey';
export class BrowserWorkspaceService extends Disposable implements IWorkspaceContextService {
	declare _serviceBrand: undefined;

	private readonly _onDidChangeWorkbenchState: Emitter<WorkbenchState> = this._register(new Emitter<WorkbenchState>());
	public readonly onDidChangeWorkbenchState: Event<WorkbenchState> = this._onDidChangeWorkbenchState.event;

	private readonly _onDidChangeWorkspaceName: Emitter<void> = this._register(new Emitter<void>());
	public readonly onDidChangeWorkspaceName: Event<void> = this._onDidChangeWorkspaceName.event;

	private readonly _onDidChangeWorkspacePages: Emitter<void> = this._register(new Emitter<void>());
	public readonly onDidChangeWorkspacePages: Event<void> = this._onDidChangeWorkspacePages.event;

	private readonly _onDidChangeWorkspace: Emitter<void> = this._register(new Emitter<void>());
	public readonly onDidChangeWorkspace: Event<void> = this._onDidChangeWorkspace.event;

	private workspace!: Workspace;

	/**
	 * Support multiple user in same time
	 */
	private spaceRootStores: SpaceRootStore[];
	private currentSpaceId!: string;

	constructor(
		@IUserService private readonly userService: IUserService,
		@IEditorService private readonly editorService: IEditorService,
		@IStoreService private readonly storeService: IStoreService,
		@IStorageService private readonly storageService: IStorageService,
	) {
		super();

		this.spaceRootStores = [];

		// Register storeage to use later
		StoreStorageProvider.INSTANCE.registerStorage(storageService);

		this.currentSpaceId = storageService.get(
			CurrentSpaceIdStorageKey, StorageScope.WORKSPACE, '');

		this._register(userService.onDidChangeCurrentProfile((profile) => this.onProfileChange(profile)));

		if (!userService.currentProfile) {
			this.workspace = new Workspace(this.currentSpaceId, [], false, null, () => true);
			return;
		}

		const userIdSet = [userService.currentProfile.id, 'local'];

		userIdSet.forEach((userId) => {
			const spaceRootStore = new SpaceRootStore(userId, this.storeService);
			this._register(spaceRootStore.onDidChange(() => {
				this._onDidChangeWorkspace.fire();
			}));
			this.spaceRootStores.push(spaceRootStore);
		});

		this.initialize();
	}

	async onProfileChange(profile: IUserProfile | undefined) {
		if (!profile) {
			return;
		}
		const spaceRootStore = new SpaceRootStore(profile.id, this.storeService);
		// Need to load space root load into cache
		await spaceRootStore.load();
		this._register(spaceRootStore.onDidChange(() => {
			this._onDidChangeWorkspace.fire();
		}));
		this.spaceRootStores.push(spaceRootStore);
		this._onDidChangeWorkspace.fire();
		this.initialize();
	}

	getSpaceStores(): SpaceStore[] {
		return this.spaceRootStores.flatMap(store => store.getSpaceStores());
	}

	getSpaceStore(): SpaceStore | undefined {
		const spaceStores = this.getSpaceStores();
		if (spaceStores.length > 0) {
			if (this.currentSpaceId) {
				const idx = Lodash.findIndex(spaceStores, (store) => store.id === this.currentSpaceId);
				if (idx >= 0) {
					return spaceStores[idx];
				}
			}
			return spaceStores[0];
		}
		return undefined;
	}

	enterWorkspace(spaceId: string) {
		this.currentSpaceId = spaceId;
		this.storageService.store(CurrentSpaceIdStorageKey, spaceId, StorageScope.WORKSPACE, StorageTarget.MACHINE);

		this._onDidChangeWorkspace.fire();
	}

	getWorkspace(): IWorkspace {
		return this.workspace;
	}

	async initialize() {
		const spaceStore = this.getSpaceStore();
		if (spaceStore) {
			const pages: IWorkspacePage[] = spaceStore.getPagesStores().map((pageStore, index) => {
				const name = pageStore.getTitleStore();
				const uri = URI.from({ scheme: 'mote', path: `page/${pageStore.id}` });
				return new WorkspacePage({ id: pageStore.id, uri, name: '', index });
			});
			this.workspace = new Workspace(this.currentSpaceId, pages, false, null, () => true);
		}
	}

	async createWorkspace(userId: string, spaceName: string) {

		console.log(this.userService.currentProfile);
		const spaceId = generateUuid();
		this.createSpaceStore(userId, spaceId, spaceName || 'Untitled Space');
	}

	async deleteWorkspace() {

	}

	/**
	 * Todo move it to commands later....
	 * @param spaceName
	 * @returns
	 */
	private async createSpaceStore(userId: string, spaceId: string, spaceName: string) {
		const spaceRootStore = new SpaceRootStore(userId, this.storeService);
		const transaction = Transaction.create(userId);
		let child = new SpaceStore({ table: 'space', id: spaceId }, { userId }, this.storeService);
		EditOperation.addSetOperationForStore(child, { name: spaceName }, transaction);
		child = EditOperation.appendToParent(spaceRootStore.getSpacesStore(), child, transaction).child as SpaceStore;
		await transaction.commit();
		this.enterWorkspace(spaceId);
		return child;
	}
}

registerSingleton(IWorkspaceContextService, BrowserWorkspaceService as any, InstantiationType.Delayed);
