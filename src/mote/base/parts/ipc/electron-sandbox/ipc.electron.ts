/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from 'mote/base/common/buffer';
import { Event } from 'mote/base/common/event';
import { IDisposable } from 'mote/base/common/lifecycle';
import { IPCClient } from 'mote/base/parts/ipc/common/ipc';
import { Protocol as ElectronProtocol } from 'mote/base/parts/ipc/common/ipc.electron';
import { ipcRenderer } from 'mote/base/parts/sandbox/electron-sandbox/globals';

/**
 * An implementation of `IPCClient` on top of Electron `ipcRenderer` IPC communication
 * provided from sandbox globals (via preload script).
 */
export class Client extends IPCClient implements IDisposable {

	private protocol: ElectronProtocol;

	private static createProtocol(): ElectronProtocol {
		const onMessage = Event.fromNodeEventEmitter<VSBuffer>(ipcRenderer, 'mote:message', (_, message) => VSBuffer.wrap(message));
		ipcRenderer.send('mote:hello');

		return new ElectronProtocol(ipcRenderer, onMessage);
	}

	constructor(id: string) {
		const protocol = Client.createProtocol();
		super(protocol, id);

		this.protocol = protocol;
	}

	override dispose(): void {
		this.protocol.disconnect();
	}
}
