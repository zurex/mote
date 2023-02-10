/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IFileService } from 'mote/platform/files/common/files';
import { IRemoteAgentService } from 'mote/workbench/services/remote/common/remoteAgentService';
import { IWorkbenchEnvironmentService } from 'mote/workbench/services/environment/common/environmentService';
import { IUriIdentityService } from 'mote/platform/uriIdentity/common/uriIdentity';
import { ILabelService } from 'mote/platform/label/common/label';
import { ILogService } from 'mote/platform/log/common/log';
import { IConfigurationService } from 'mote/platform/configuration/common/configuration';
import { IWorkingCopyHistoryModelOptions, WorkingCopyHistoryService } from 'mote/workbench/services/workingCopy/common/workingCopyHistoryService';
import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { IWorkingCopyHistoryService } from 'mote/workbench/services/workingCopy/common/workingCopyHistory';

export class BrowserWorkingCopyHistoryService extends WorkingCopyHistoryService {

	constructor(
		@IFileService fileService: IFileService,
		@IRemoteAgentService remoteAgentService: IRemoteAgentService,
		@IWorkbenchEnvironmentService environmentService: IWorkbenchEnvironmentService,
		@IUriIdentityService uriIdentityService: IUriIdentityService,
		@ILabelService labelService: ILabelService,
		@ILogService logService: ILogService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		super(fileService, remoteAgentService, environmentService, uriIdentityService, labelService, logService, configurationService);
	}

	protected getModelOptions(): IWorkingCopyHistoryModelOptions {
		return { flushOnChange: true /* because browsers support no long running shutdown */ };
	}
}

// Register Service
registerSingleton(IWorkingCopyHistoryService, BrowserWorkingCopyHistoryService, InstantiationType.Delayed);
