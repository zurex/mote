/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'mote/base/common/lifecycle';
import { IChannel, IServerChannel } from 'mote/base/parts/ipc/common/ipc';
import { Client as IPCElectronClient } from 'mote/base/parts/ipc/electron-sandbox/ipc.electron';
import { IMainProcessService } from 'mote/platform/ipc/electron-sandbox/services';

/**
 * An implementation of `IMainProcessService` that leverages Electron's IPC.
 */
export class ElectronIPCMainProcessService extends Disposable implements IMainProcessService {

	declare readonly _serviceBrand: undefined;

	private mainProcessConnection: IPCElectronClient;

	constructor(
		windowId: number
	) {
		super();

		this.mainProcessConnection = this._register(new IPCElectronClient(`window:${windowId}`));
	}

	getChannel(channelName: string): IChannel {
		return this.mainProcessConnection.getChannel(channelName);
	}

	registerChannel(channelName: string, channel: IServerChannel<string>): void {
		this.mainProcessConnection.registerChannel(channelName, channel);
	}
}
