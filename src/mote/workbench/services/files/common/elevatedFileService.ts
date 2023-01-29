/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'mote/platform/instantiation/common/instantiation';
import { URI } from 'mote/base/common/uri';
import { VSBuffer, VSBufferReadable, VSBufferReadableStream } from 'mote/base/common/buffer';
import { IFileStatWithMetadata, IWriteFileOptions } from 'mote/platform/files/common/files';

export const IElevatedFileService = createDecorator<IElevatedFileService>('elevatedFileService');

export interface IElevatedFileService {

	readonly _serviceBrand: undefined;

	/**
	 * Whether saving elevated is supported for the provided resource.
	 */
	isSupported(resource: URI): boolean;

	/**
	 * Attempts to write to the target resource elevated. This may bring
	 * up a dialog to ask for admin username / password.
	 */
	writeFileElevated(resource: URI, value: VSBuffer | VSBufferReadable | VSBufferReadableStream, options?: IWriteFileOptions): Promise<IFileStatWithMetadata>;
}
