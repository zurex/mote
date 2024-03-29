/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'mote/base/common/lifecycle';
import { join } from 'mote/base/common/path';
import * as pfs from 'mote/base/node/pfs';
import { INativeEnvironmentService } from 'mote/platform/environment/common/environment';
import { DidUninstallExtensionEvent, IExtensionManagementService, InstallExtensionResult } from 'mote/platform/extensionManagement/common/extensionManagement';
import { MANIFEST_CACHE_FOLDER, USER_MANIFEST_CACHE_FILE } from 'mote/platform/extensions/common/extensions';

export class ExtensionsManifestCache extends Disposable {

	private extensionsManifestCache = join(this.environmentService.userDataPath, MANIFEST_CACHE_FOLDER, USER_MANIFEST_CACHE_FILE);

	constructor(
		private readonly environmentService: INativeEnvironmentService,
		extensionsManagementService: IExtensionManagementService
	) {
		super();
		this._register(extensionsManagementService.onDidInstallExtensions(e => this.onDidInstallExtensions(e)));
		this._register(extensionsManagementService.onDidUninstallExtension(e => this.onDidUnInstallExtension(e)));
	}

	private onDidInstallExtensions(results: readonly InstallExtensionResult[]): void {
		if (results.some(r => !!r.local)) {
			this.invalidate();
		}
	}

	private onDidUnInstallExtension(e: DidUninstallExtensionEvent): void {
		if (!e.error) {
			this.invalidate();
		}
	}

	invalidate(): void {
		pfs.Promises.rm(this.extensionsManifestCache, pfs.RimRafMode.MOVE).then(() => { }, () => { });
	}
}
