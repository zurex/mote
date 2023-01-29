/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IURLService, IURLHandler, IOpenURLOptions } from 'mote/platform/url/common/url';
import { URI, UriComponents } from 'mote/base/common/uri';
import { IMainProcessService } from 'mote/platform/ipc/electron-sandbox/services';
import { URLHandlerChannel } from 'mote/platform/url/common/urlIpc';
import { IOpenerService, IOpener, matchesScheme } from 'mote/platform/opener/common/opener';
import { IProductService } from 'mote/platform/product/common/productService';
import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { ProxyChannel } from 'mote/base/parts/ipc/common/ipc';
import { INativeHostService } from 'mote/platform/native/electron-sandbox/native';
import { NativeURLService } from 'mote/platform/url/common/urlService';

export interface IRelayOpenURLOptions extends IOpenURLOptions {
	openToSide?: boolean;
	openExternal?: boolean;
}

export class RelayURLService extends NativeURLService implements IURLHandler, IOpener {

	private urlService: IURLService;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService,
		@IOpenerService openerService: IOpenerService,
		@INativeHostService private readonly nativeHostService: INativeHostService,
		@IProductService productService: IProductService
	) {
		super(productService);

		this.urlService = ProxyChannel.toService<IURLService>(mainProcessService.getChannel('url'));

		mainProcessService.registerChannel('urlHandler', new URLHandlerChannel(this));
		openerService.registerOpener(this);
	}

	override create(options?: Partial<UriComponents>): URI {
		const uri = super.create(options);

		let query = uri.query;
		if (!query) {
			query = `windowId=${encodeURIComponent(this.nativeHostService.windowId)}`;
		} else {
			query += `&windowId=${encodeURIComponent(this.nativeHostService.windowId)}`;
		}

		return uri.with({ query });
	}

	override async open(resource: URI | string, options?: IRelayOpenURLOptions): Promise<boolean> {

		if (!matchesScheme(resource, this.productService.urlProtocol)) {
			return false;
		}

		if (typeof resource === 'string') {
			resource = URI.parse(resource);
		}
		return await this.urlService.open(resource, options);
	}

	async handleURL(uri: URI, options?: IOpenURLOptions): Promise<boolean> {
		const result = await super.open(uri, options);

		if (result) {
			await this.nativeHostService.focusWindow({ force: true /* Application may not be active */ });
		}

		return result;
	}
}

registerSingleton(IURLService, RelayURLService, InstantiationType.Eager);
