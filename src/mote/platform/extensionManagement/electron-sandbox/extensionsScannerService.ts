/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'mote/base/common/uri';
import { INativeEnvironmentService } from 'mote/platform/environment/common/environment';
import { IExtensionsProfileScannerService } from 'mote/platform/extensionManagement/common/extensionsProfileScannerService';
import { IExtensionsScannerService, NativeExtensionsScannerService, } from 'mote/platform/extensionManagement/common/extensionsScannerService';
import { IFileService } from 'mote/platform/files/common/files';
import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { IInstantiationService } from 'mote/platform/instantiation/common/instantiation';
import { ILogService } from 'mote/platform/log/common/log';
import { IProductService } from 'mote/platform/product/common/productService';
import { IUriIdentityService } from 'mote/platform/uriIdentity/common/uriIdentity';
import { IUserDataProfilesService } from 'mote/platform/userDataProfile/common/userDataProfile';

export class ExtensionsScannerService extends NativeExtensionsScannerService implements IExtensionsScannerService {

	constructor(
		@IUserDataProfilesService userDataProfilesService: IUserDataProfilesService,
		@IExtensionsProfileScannerService extensionsProfileScannerService: IExtensionsProfileScannerService,
		@IFileService fileService: IFileService,
		@ILogService logService: ILogService,
		@INativeEnvironmentService environmentService: INativeEnvironmentService,
		@IProductService productService: IProductService,
		@IUriIdentityService uriIdentityService: IUriIdentityService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super(
			URI.file(environmentService.builtinExtensionsPath),
			URI.file(environmentService.extensionsPath),
			environmentService.userHome,
			URI.file(environmentService.userDataPath),
			userDataProfilesService, extensionsProfileScannerService, fileService, logService, environmentService, productService, uriIdentityService, instantiationService);
	}

}

registerSingleton(IExtensionsScannerService, ExtensionsScannerService, InstantiationType.Delayed);
