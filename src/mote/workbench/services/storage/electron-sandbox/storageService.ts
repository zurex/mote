/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEnvironmentService } from 'mote/platform/environment/common/environment';
import { IMainProcessService } from 'mote/platform/ipc/electron-sandbox/services';
import { NativeStorageService } from 'mote/platform/storage/electron-sandbox/storageService';
import { IUserDataProfilesService } from 'mote/platform/userDataProfile/common/userDataProfile';
import { IAnyWorkspaceIdentifier } from 'mote/platform/workspace/common/workspace';
import { IUserDataProfileService } from 'mote/workbench/services/userDataProfile/common/userDataProfile';

export class NativeWorkbenchStorageService extends NativeStorageService {

	constructor(
		workspace: IAnyWorkspaceIdentifier | undefined,
		private readonly userDataProfileService: IUserDataProfileService,
		userDataProfilesService: IUserDataProfilesService,
		mainProcessService: IMainProcessService,
		environmentService: IEnvironmentService
	) {
		super(workspace, { currentProfile: userDataProfileService.currentProfile, defaultProfile: userDataProfilesService.defaultProfile }, mainProcessService, environmentService);

		this.registerListeners();
	}

	private registerListeners(): void {
		this._register(this.userDataProfileService.onDidChangeCurrentProfile(e => e.join(this.switchToProfile(e.profile, e.preserveData))));
	}
}
