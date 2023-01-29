import { IThemeService, Themable } from 'mote/platform/theme/common/themeService';
import { Memento, MementoObject } from 'mote/workbench/common/memento';
import { IStorageService, StorageScope, StorageTarget } from 'mote/platform/storage/common/storage';

export class Component extends Themable {

	private readonly memento: Memento;

	constructor(
		private readonly id: string,
		themeService: IThemeService,
		storageService: IStorageService
	) {
		super(themeService);

		this.memento = new Memento(this.id, storageService);

		/*
		this._register(storageService.onWillSaveState(() => {

			// Ask the component to persist state into the memento
			this.saveState();

			// Then save the memento into storage
			this.memento.saveMemento();
		}));
		*/
	}

	getId(): string {
		return this.id;
	}

	protected getMemento(scope: StorageScope, target: StorageTarget): MementoObject {
		return this.memento.getMemento(scope, target);
	}

	protected saveState(): void {
		// Subclasses to implement for storing state
	}
}
