/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from 'mote/base/common/event';
import { addMatchMediaChangeListener } from 'mote/base/browser/browser';
import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { Disposable } from 'mote/base/common/lifecycle';
import { IHostColorSchemeService } from 'mote/workbench/services/themes/common/hostColorSchemeService';

export class BrowserHostColorSchemeService extends Disposable implements IHostColorSchemeService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidSchemeChangeEvent = this._register(new Emitter<void>());

	constructor(
	) {
		super();

		this.registerListeners();
	}

	private registerListeners(): void {

		addMatchMediaChangeListener('(prefers-color-scheme: dark)', () => {
			this._onDidSchemeChangeEvent.fire();
		});
		addMatchMediaChangeListener('(forced-colors: active)', () => {
			this._onDidSchemeChangeEvent.fire();
		});
	}

	get onDidChangeColorScheme(): Event<void> {
		return this._onDidSchemeChangeEvent.event;
	}

	get dark(): boolean {
		if (window.matchMedia(`(prefers-color-scheme: light)`).matches) {
			return false;
		} else if (window.matchMedia(`(prefers-color-scheme: dark)`).matches) {
			return true;
		}
		return false;
	}

	get highContrast(): boolean {
		if (window.matchMedia(`(forced-colors: active)`).matches) {
			return true;
		}
		return false;
	}

}

registerSingleton(IHostColorSchemeService, BrowserHostColorSchemeService, InstantiationType.Delayed);
