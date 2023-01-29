import { InMemoryStorageService, IStorageService } from 'mote/platform/storage/common/storage';

export class StoreStorageProvider {
	public static readonly INSTANCE = new StoreStorageProvider();

	private storage: IStorageService;

	constructor() {
		this.storage = new InMemoryStorageService();
	}

	public registerStorage(storageService: IStorageService) {
		this.storage = storageService;
	}

	public get() {
		return this.storage;
	}
}
