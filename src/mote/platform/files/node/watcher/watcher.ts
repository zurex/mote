/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'mote/base/common/lifecycle';
import { INonRecursiveWatchRequest, IRecursiveWatchRequest, IUniversalWatcher, IUniversalWatchRequest } from 'mote/platform/files/common/watcher';
import { Event } from 'mote/base/common/event';
import { ParcelWatcher } from 'mote/platform/files/node/watcher/parcel/parcelWatcher';
import { NodeJSWatcher } from 'mote/platform/files/node/watcher/nodejs/nodejsWatcher';
import { Promises } from 'mote/base/common/async';

export class UniversalWatcher extends Disposable implements IUniversalWatcher {

	private readonly recursiveWatcher = this._register(new ParcelWatcher());
	private readonly nonRecursiveWatcher = this._register(new NodeJSWatcher());

	readonly onDidChangeFile = Event.any(this.recursiveWatcher.onDidChangeFile, this.nonRecursiveWatcher.onDidChangeFile);
	readonly onDidLogMessage = Event.any(this.recursiveWatcher.onDidLogMessage, this.nonRecursiveWatcher.onDidLogMessage);
	readonly onDidError = Event.any(this.recursiveWatcher.onDidError, this.nonRecursiveWatcher.onDidError);

	async watch(requests: IUniversalWatchRequest[]): Promise<void> {
		const recursiveWatchRequests: IRecursiveWatchRequest[] = [];
		const nonRecursiveWatchRequests: INonRecursiveWatchRequest[] = [];

		for (const request of requests) {
			if (request.recursive) {
				recursiveWatchRequests.push(request);
			} else {
				nonRecursiveWatchRequests.push(request);
			}
		}

		await Promises.settled([
			this.recursiveWatcher.watch(recursiveWatchRequests),
			this.nonRecursiveWatcher.watch(nonRecursiveWatchRequests)
		]);
	}

	async setVerboseLogging(enabled: boolean): Promise<void> {
		await Promises.settled([
			this.recursiveWatcher.setVerboseLogging(enabled),
			this.nonRecursiveWatcher.setVerboseLogging(enabled)
		]);
	}

	async stop(): Promise<void> {
		await Promises.settled([
			this.recursiveWatcher.stop(),
			this.nonRecursiveWatcher.stop()
		]);
	}
}
