/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILogService } from 'mote/platform/log/common/log';
import { IUserDataProfilesService } from 'mote/platform/userDataProfile/common/userDataProfile';
import { IUriIdentityService } from 'mote/platform/uriIdentity/common/uriIdentity';
import { ITelemetryService } from 'mote/platform/telemetry/common/telemetry';
import { AbstractExtensionsProfileScannerService } from 'mote/platform/extensionManagement/common/extensionsProfileScannerService';
import { IFileService } from 'mote/platform/files/common/files';
import { INativeEnvironmentService } from 'mote/platform/environment/common/environment';
import { URI } from 'mote/base/common/uri';

export class ExtensionsProfileScannerService extends AbstractExtensionsProfileScannerService {
	constructor(
		@INativeEnvironmentService environmentService: INativeEnvironmentService,
		@IFileService fileService: IFileService,
		@IUserDataProfilesService userDataProfilesService: IUserDataProfilesService,
		@IUriIdentityService uriIdentityService: IUriIdentityService,
		@ITelemetryService telemetryService: ITelemetryService,
		@ILogService logService: ILogService,
	) {
		super(URI.file(environmentService.extensionsPath), fileService, userDataProfilesService, uriIdentityService, telemetryService, logService);
	}
}
