/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { shell } from 'electron';
import { localize } from 'mote/nls';
import { isWindows } from 'mote/base/common/platform';
import { Emitter } from 'mote/base/common/event';
import { URI, UriComponents } from 'mote/base/common/uri';
import { IFileDeleteOptions, IFileChange, IWatchOptions, createFileSystemProviderError, FileSystemProviderErrorCode } from 'mote/platform/files/common/files';
import { DiskFileSystemProvider } from 'mote/platform/files/node/diskFileSystemProvider';
import { basename, normalize } from 'mote/base/common/path';
import { IDisposable } from 'mote/base/common/lifecycle';
import { ILogService } from 'mote/platform/log/common/log';
import { AbstractDiskFileSystemProviderChannel, AbstractSessionFileWatcher, ISessionFileWatcher } from 'mote/platform/files/node/diskFileSystemProviderServer';
import { DefaultURITransformer, IURITransformer } from 'mote/base/common/uriIpc';
import { IEnvironmentService } from 'mote/platform/environment/common/environment';

export class DiskFileSystemProviderChannel extends AbstractDiskFileSystemProviderChannel<unknown> {

	constructor(
		provider: DiskFileSystemProvider,
		logService: ILogService,
		private readonly environmentService: IEnvironmentService
	) {
		super(provider, logService);
	}

	protected override getUriTransformer(ctx: unknown): IURITransformer {
		return DefaultURITransformer;
	}

	protected override transformIncoming(uriTransformer: IURITransformer, _resource: UriComponents): URI {
		return URI.revive(_resource);
	}

	//#region Delete: override to support Electron's trash support

	protected override async delete(uriTransformer: IURITransformer, _resource: UriComponents, opts: IFileDeleteOptions): Promise<void> {
		if (!opts.useTrash) {
			return super.delete(uriTransformer, _resource, opts);
		}

		const resource = this.transformIncoming(uriTransformer, _resource);
		const filePath = normalize(resource.fsPath);
		try {
			await shell.trashItem(filePath);
		} catch (error) {
			throw createFileSystemProviderError(isWindows ? localize('binFailed', "Failed to move '{0}' to the recycle bin", basename(filePath)) : localize('trashFailed', "Failed to move '{0}' to the trash", basename(filePath)), FileSystemProviderErrorCode.Unknown);
		}
	}

	//#endregion

	//#region File Watching

	protected createSessionFileWatcher(uriTransformer: IURITransformer, emitter: Emitter<IFileChange[] | string>): ISessionFileWatcher {
		return new SessionFileWatcher(uriTransformer, emitter, this.logService, this.environmentService);
	}

	//#endregion

}

class SessionFileWatcher extends AbstractSessionFileWatcher {

	override watch(req: number, resource: URI, opts: IWatchOptions): IDisposable {
		if (opts.recursive) {
			throw createFileSystemProviderError('Recursive file watching is not supported from main process for performance reasons.', FileSystemProviderErrorCode.Unavailable);
		}

		return super.watch(req, resource, opts);
	}
}
