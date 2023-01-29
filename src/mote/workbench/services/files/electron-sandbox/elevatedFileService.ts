/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer, VSBufferReadable, VSBufferReadableStream } from 'mote/base/common/buffer';
import { randomPath } from 'mote/base/common/extpath';
import { Schemas } from 'mote/base/common/network';
import { URI } from 'mote/base/common/uri';
import { IFileService, IFileStatWithMetadata, IWriteFileOptions } from 'mote/platform/files/common/files';
import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { INativeHostService } from 'mote/platform/native/electron-sandbox/native';
import { INativeWorkbenchEnvironmentService } from 'mote/workbench/services/environment/electron-sandbox/environmentService';
import { IElevatedFileService } from 'mote/workbench/services/files/common/elevatedFileService';

export class NativeElevatedFileService implements IElevatedFileService {

	readonly _serviceBrand: undefined;

	constructor(
		@INativeHostService private readonly nativeHostService: INativeHostService,
		@IFileService private readonly fileService: IFileService,
		@INativeWorkbenchEnvironmentService private readonly environmentService: INativeWorkbenchEnvironmentService
	) { }

	isSupported(resource: URI): boolean {
		// Saving elevated is currently only supported for local
		// files for as long as we have no generic support from
		// the file service
		// (https://github.com/microsoft/vscode/issues/48659)
		return resource.scheme === Schemas.file;
	}

	async writeFileElevated(resource: URI, value: VSBuffer | VSBufferReadable | VSBufferReadableStream, options?: IWriteFileOptions): Promise<IFileStatWithMetadata> {
		const source = URI.file(randomPath(this.environmentService.userDataPath, 'code-elevated'));
		try {
			// write into a tmp file first
			await this.fileService.writeFile(source, value, options);

			// then sudo prompt copy
			await this.nativeHostService.writeElevated(source, resource, options);
		} finally {

			// clean up
			await this.fileService.del(source);
		}

		return this.fileService.resolve(resource, { resolveMetadata: true });
	}
}

registerSingleton(IElevatedFileService, NativeElevatedFileService, InstantiationType.Delayed);
