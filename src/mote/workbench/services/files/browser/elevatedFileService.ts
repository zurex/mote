/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer, VSBufferReadable, VSBufferReadableStream } from 'mote/base/common/buffer';
import { URI } from 'mote/base/common/uri';
import { IFileStatWithMetadata, IWriteFileOptions } from 'mote/platform/files/common/files';
import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { IElevatedFileService } from 'mote/workbench/services/files/common/elevatedFileService';

export class BrowserElevatedFileService implements IElevatedFileService {

	readonly _serviceBrand: undefined;

	isSupported(resource: URI): boolean {
		// Saving elevated is currently not supported in web for as
		// long as we have no generic support from the file service
		// (https://github.com/microsoft/vscode/issues/48659)
		return false;
	}

	async writeFileElevated(resource: URI, value: VSBuffer | VSBufferReadable | VSBufferReadableStream, options?: IWriteFileOptions): Promise<IFileStatWithMetadata> {
		throw new Error('Unsupported');
	}
}

registerSingleton(IElevatedFileService, BrowserElevatedFileService, InstantiationType.Delayed);
