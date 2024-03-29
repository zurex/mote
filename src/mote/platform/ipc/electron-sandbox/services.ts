/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IChannel, IServerChannel, ProxyChannel } from 'mote/base/parts/ipc/common/ipc';
import { SyncDescriptor } from 'mote/platform/instantiation/common/descriptors';
import { registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { createDecorator, IInstantiationService, ServiceIdentifier } from 'mote/platform/instantiation/common/instantiation';

type ChannelClientCtor<T> = { new(channel: IChannel, ...args: any[]): T };
type Remote = { getChannel(channelName: string): IChannel };

abstract class RemoteServiceStub<T extends object> {
	constructor(
		channelName: string,
		options: IRemoteServiceWithChannelClientOptions<T> | IRemoteServiceWithProxyOptions | undefined,
		remote: Remote,
		instantiationService: IInstantiationService
	) {
		const channel = remote.getChannel(channelName);

		if (isRemoteServiceWithChannelClientOptions(options)) {
			return instantiationService.createInstance(new SyncDescriptor(options.channelClientCtor, [channel]));
		}

		return ProxyChannel.toService(channel, options?.proxyOptions);
	}
}

export interface IRemoteServiceWithChannelClientOptions<T> {
	readonly channelClientCtor: ChannelClientCtor<T>;
}

export interface IRemoteServiceWithProxyOptions {
	readonly proxyOptions?: ProxyChannel.ICreateProxyServiceOptions;
}

function isRemoteServiceWithChannelClientOptions<T>(obj: unknown): obj is IRemoteServiceWithChannelClientOptions<T> {
	const candidate = obj as IRemoteServiceWithChannelClientOptions<T> | undefined;

	return !!candidate?.channelClientCtor;
}

//#region Main Process

export const IMainProcessService = createDecorator<IMainProcessService>('mainProcessService');

export interface IMainProcessService {
	readonly _serviceBrand: undefined;
	getChannel(channelName: string): IChannel;
	registerChannel(channelName: string, channel: IServerChannel<string>): void;
}

class MainProcessRemoteServiceStub<T extends object> extends RemoteServiceStub<T> {
	constructor(channelName: string, options: IRemoteServiceWithChannelClientOptions<T> | IRemoteServiceWithProxyOptions | undefined, @IMainProcessService ipcService: IMainProcessService, @IInstantiationService instantiationService: IInstantiationService) {
		super(channelName, options, ipcService, instantiationService);
	}
}

export function registerMainProcessRemoteService<T>(id: ServiceIdentifier<T>, channelName: string, options?: IRemoteServiceWithChannelClientOptions<T> | IRemoteServiceWithProxyOptions): void {
	registerSingleton(id, new SyncDescriptor(MainProcessRemoteServiceStub, [channelName, options], true));
}

//#endregion

//#region Shared Process

export const ISharedProcessService = createDecorator<ISharedProcessService>('sharedProcessService');

export interface ISharedProcessService {

	readonly _serviceBrand: undefined;

	getChannel(channelName: string): IChannel;
	registerChannel(channelName: string, channel: IServerChannel<string>): void;

	notifyRestored(): void;
}

class SharedProcessRemoteServiceStub<T extends object> extends RemoteServiceStub<T> {
	constructor(channelName: string, options: IRemoteServiceWithChannelClientOptions<T> | IRemoteServiceWithProxyOptions | undefined, @ISharedProcessService ipcService: ISharedProcessService, @IInstantiationService instantiationService: IInstantiationService) {
		super(channelName, options, ipcService, instantiationService);
	}
}

export function registerSharedProcessRemoteService<T>(id: ServiceIdentifier<T>, channelName: string, options?: IRemoteServiceWithChannelClientOptions<T> | IRemoteServiceWithProxyOptions): void {
	registerSingleton(id, new SyncDescriptor(SharedProcessRemoteServiceStub, [channelName, options], true));
}

//#endregion
