/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from 'mote/base/common/event';
import { MutableDisposable } from 'mote/base/common/lifecycle';
import { IStorageDatabase } from 'mote/base/parts/storage/common/storage';
import { IMainProcessService } from 'mote/platform/ipc/electron-sandbox/services';
import { ILogService } from 'mote/platform/log/common/log';
import { AbstractUserDataProfileStorageService, IProfileStorageChanges, IUserDataProfileStorageService } from 'mote/platform/userDataProfile/common/userDataProfileStorageService';
import { isProfileUsingDefaultStorage, IStorageService } from 'mote/platform/storage/common/storage';
import { ApplicationStorageDatabaseClient, ProfileStorageDatabaseClient } from 'mote/platform/storage/common/storageIpc';
import { IUserDataProfile, IUserDataProfilesService, reviveProfile } from 'mote/platform/userDataProfile/common/userDataProfile';
import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';

export class UserDataProfileStorageService extends AbstractUserDataProfileStorageService implements IUserDataProfileStorageService {

	private readonly _onDidChange: Emitter<IProfileStorageChanges>;
	readonly onDidChange: Event<IProfileStorageChanges>;

	constructor(
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
		@IUserDataProfilesService userDataProfilesService: IUserDataProfilesService,
		@IStorageService storageService: IStorageService,
		@ILogService logService: ILogService,
	) {
		super(storageService);

		const channel = mainProcessService.getChannel('profileStorageListener');
		const disposable = this._register(new MutableDisposable());
		this._onDidChange = this._register(new Emitter<IProfileStorageChanges>({
			// Start listening to profile storage changes only when someone is listening
			onWillAddFirstListener: () => {
				disposable.value = channel.listen<IProfileStorageChanges>('onDidChange')(e => {
					logService.trace('profile storage changes', e);
					this._onDidChange.fire({
						targetChanges: e.targetChanges.map(profile => reviveProfile(profile, userDataProfilesService.profilesHome.scheme)),
						valueChanges: e.valueChanges.map(e => ({ ...e, profile: reviveProfile(e.profile, userDataProfilesService.profilesHome.scheme) }))
					});
				});
			},
			// Stop listening to profile storage changes when no one is listening
			onDidRemoveLastListener: () => disposable.value = undefined
		}));
		this.onDidChange = this._onDidChange.event;
	}

	protected async createStorageDatabase(profile: IUserDataProfile): Promise<IStorageDatabase> {
		const storageChannel = this.mainProcessService.getChannel('storage');
		return isProfileUsingDefaultStorage(profile) ? new ApplicationStorageDatabaseClient(storageChannel) : new ProfileStorageDatabaseClient(storageChannel, profile);
	}
}

registerSingleton(IUserDataProfileStorageService, UserDataProfileStorageService, InstantiationType.Delayed);
