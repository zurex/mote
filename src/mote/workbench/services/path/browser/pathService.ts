/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { IPathService, AbstractPathService } from 'mote/workbench/services/path/common/pathService';
import { URI } from 'mote/base/common/uri';
import { IWorkbenchEnvironmentService } from 'mote/workbench/services/environment/common/environmentService';
import { IWorkspaceContextService } from 'mote/platform/workspace/common/workspace';
import { firstOrDefault } from 'mote/base/common/arrays';
import { dirname } from 'mote/base/common/resources';

export class BrowserPathService extends AbstractPathService {

	constructor(
		//@IRemoteAgentService remoteAgentService: IRemoteAgentService,
		@IWorkbenchEnvironmentService environmentService: IWorkbenchEnvironmentService,
		@IWorkspaceContextService contextService: IWorkspaceContextService
	) {
		super(
			guessLocalUserHome(environmentService, contextService),
			environmentService,
			contextService
		);
	}
}

function guessLocalUserHome(environmentService: IWorkbenchEnvironmentService, contextService: IWorkspaceContextService): URI {

	// In web we do not really have the concept of a "local" user home
	// but we still require it in many places as a fallback. As such,
	// we have to come up with a synthetic location derived from the
	// environment.

	const workspace = contextService.getWorkspace();

	const firstPage = firstOrDefault(workspace.pages);
	if (firstPage) {
		return firstPage.uri;
	}

	if (workspace.configuration) {
		return dirname(workspace.configuration);
	}

	// This is not ideal because with a user home location of `/`, all paths
	// will potentially appear with `~/...`, but at this point we really do
	// not have any other good alternative.

	return URI.from({
		scheme: AbstractPathService.findDefaultUriScheme(environmentService, contextService),
		authority: environmentService.remoteAuthority,
		path: '/'
	});
}

registerSingleton(IPathService, BrowserPathService, InstantiationType.Delayed);
