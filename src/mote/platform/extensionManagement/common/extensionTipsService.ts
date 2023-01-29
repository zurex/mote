/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isNonEmptyArray } from 'mote/base/common/arrays';
import { Disposable } from 'mote/base/common/lifecycle';
import { IConfigBasedExtensionTip as IRawConfigBasedExtensionTip } from 'mote/base/common/product';
import { joinPath } from 'mote/base/common/resources';
import { URI } from 'mote/base/common/uri';
import { getDomainsOfRemotes } from 'mote/platform/extensionManagement/common/configRemotes';
import { IConfigBasedExtensionTip, IExecutableBasedExtensionTip, IExtensionTipsService } from 'mote/platform/extensionManagement/common/extensionManagement';
import { IFileService } from 'mote/platform/files/common/files';
import { IProductService } from 'mote/platform/product/common/productService';

export class ExtensionTipsService extends Disposable implements IExtensionTipsService {

	_serviceBrand: any;

	private readonly allConfigBasedTips: Map<string, IRawConfigBasedExtensionTip> = new Map<string, IRawConfigBasedExtensionTip>();

	constructor(
		@IFileService protected readonly fileService: IFileService,
		@IProductService private readonly productService: IProductService,
	) {
		super();
		if (this.productService.configBasedExtensionTips) {
			Object.entries(this.productService.configBasedExtensionTips).forEach(([, value]) => this.allConfigBasedTips.set(value.configPath, value));
		}
	}

	getConfigBasedTips(folder: URI): Promise<IConfigBasedExtensionTip[]> {
		return this.getValidConfigBasedTips(folder);
	}

	async getImportantExecutableBasedTips(): Promise<IExecutableBasedExtensionTip[]> {
		return [];
	}

	async getOtherExecutableBasedTips(): Promise<IExecutableBasedExtensionTip[]> {
		return [];
	}

	private async getValidConfigBasedTips(folder: URI): Promise<IConfigBasedExtensionTip[]> {
		const result: IConfigBasedExtensionTip[] = [];
		for (const [configPath, tip] of this.allConfigBasedTips) {
			if (tip.configScheme && tip.configScheme !== folder.scheme) {
				continue;
			}
			try {
				const content = await this.fileService.readFile(joinPath(folder, configPath));
				const recommendationByRemote: Map<string, IConfigBasedExtensionTip> = new Map<string, IConfigBasedExtensionTip>();
				Object.entries(tip.recommendations).forEach(([key, value]) => {
					if (isNonEmptyArray(value.remotes)) {
						for (const remote of value.remotes) {
							recommendationByRemote.set(remote, {
								extensionId: key,
								extensionName: value.name,
								configName: tip.configName,
								important: !!value.important,
								isExtensionPack: !!value.isExtensionPack,
								whenNotInstalled: value.whenNotInstalled
							});
						}
					} else {
						result.push({
							extensionId: key,
							extensionName: value.name,
							configName: tip.configName,
							important: !!value.important,
							isExtensionPack: !!value.isExtensionPack,
							whenNotInstalled: value.whenNotInstalled
						});
					}
				});
				const domains = getDomainsOfRemotes(content.value.toString(), [...recommendationByRemote.keys()]);
				for (const domain of domains) {
					const remote = recommendationByRemote.get(domain);
					if (remote) {
						result.push(remote);
					}
				}
			} catch (error) { /* Ignore */ }
		}
		return result;
	}

}
