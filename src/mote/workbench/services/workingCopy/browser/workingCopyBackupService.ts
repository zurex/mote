/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IFileService } from 'mote/platform/files/common/files';
import { IWorkbenchEnvironmentService } from 'mote/workbench/services/environment/common/environmentService';
import { ILogService } from 'mote/platform/log/common/log';
import { WorkingCopyBackupService } from 'mote/workbench/services/workingCopy/common/workingCopyBackupService';
import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { IWorkingCopyBackupService } from 'mote/workbench/services/workingCopy/common/workingCopyBackup';
import { joinPath } from 'mote/base/common/resources';
import { IWorkspaceContextService } from 'mote/platform/workspace/common/workspace';
import { Registry } from 'mote/platform/registry/common/platform';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'mote/workbench/common/contributions';
import { LifecyclePhase } from 'mote/workbench/services/lifecycle/common/lifecycle';
import { BrowserWorkingCopyBackupTracker } from 'mote/workbench/services/workingCopy/browser/workingCopyBackupTracker';

export class BrowserWorkingCopyBackupService extends WorkingCopyBackupService {

	constructor(
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@IWorkbenchEnvironmentService environmentService: IWorkbenchEnvironmentService,
		@IFileService fileService: IFileService,
		@ILogService logService: ILogService
	) {
		super(joinPath(environmentService.userRoamingDataHome, 'Backups', contextService.getWorkspace().id), fileService, logService);
	}
}

// Register Service
registerSingleton(IWorkingCopyBackupService, BrowserWorkingCopyBackupService, InstantiationType.Eager);

// Register Backup Tracker
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(BrowserWorkingCopyBackupTracker, LifecyclePhase.Starting);
