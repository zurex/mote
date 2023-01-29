/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { revive } from 'mote/base/common/marshalling';
import { URI, UriDto } from 'mote/base/common/uri';
import { INativeEnvironmentService } from 'mote/platform/environment/common/environment';
import { IFileService } from 'mote/platform/files/common/files';
import { ILogService } from 'mote/platform/log/common/log';
import { IStateService } from 'mote/platform/state/node/state';
import { IUriIdentityService } from 'mote/platform/uriIdentity/common/uriIdentity';
import { IUserDataProfilesService, UserDataProfilesService as BaseUserDataProfilesService, StoredUserDataProfile, StoredProfileAssociations } from 'mote/platform/userDataProfile/common/userDataProfile';

export class ServerUserDataProfilesService extends BaseUserDataProfilesService implements IUserDataProfilesService {

	constructor(
		@IUriIdentityService uriIdentityService: IUriIdentityService,
		@INativeEnvironmentService protected readonly nativeEnvironmentService: INativeEnvironmentService,
		@IFileService fileService: IFileService,
		@ILogService logService: ILogService,
	) {
		super(nativeEnvironmentService, fileService, uriIdentityService, logService);
	}

	protected override getDefaultProfileExtensionsLocation(): URI {
		return this.uriIdentityService.extUri.joinPath(URI.file(this.nativeEnvironmentService.extensionsPath).with({ scheme: this.profilesHome.scheme }), 'extensions.json');
	}

}


export class UserDataProfilesService extends ServerUserDataProfilesService implements IUserDataProfilesService {

	constructor(
		@IStateService private readonly stateService: IStateService,
		@IUriIdentityService uriIdentityService: IUriIdentityService,
		@INativeEnvironmentService nativeEnvironmentService: INativeEnvironmentService,
		@IFileService fileService: IFileService,
		@ILogService logService: ILogService,
	) {
		super(uriIdentityService, nativeEnvironmentService, fileService, logService);
	}

	protected override getStoredProfiles(): StoredUserDataProfile[] {
		return revive(this.stateService.getItem<UriDto<StoredUserDataProfile>[]>(UserDataProfilesService.PROFILES_KEY, []));
	}

	protected override getStoredProfileAssociations(): StoredProfileAssociations {
		return revive(this.stateService.getItem<UriDto<StoredProfileAssociations>>(UserDataProfilesService.PROFILE_ASSOCIATIONS_KEY, {}));
	}

	protected override getDefaultProfileExtensionsLocation(): URI {
		return this.uriIdentityService.extUri.joinPath(URI.file(this.nativeEnvironmentService.extensionsPath).with({ scheme: this.profilesHome.scheme }), 'extensions.json');
	}

}
