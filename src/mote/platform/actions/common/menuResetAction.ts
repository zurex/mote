/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'mote/nls';
import { Categories } from 'mote/platform/action/common/actionCommonCategories';
import { Action2, IMenuService } from 'mote/platform/actions/common/actions';
import { ServicesAccessor } from 'mote/platform/instantiation/common/instantiation';
import { ILogService } from 'mote/platform/log/common/log';

export class MenuHiddenStatesReset extends Action2 {

	constructor() {
		super({
			id: 'menu.resetHiddenStates',
			title: {
				value: localize('title', 'Reset All Menus'),
				original: 'Reset All Menus'
			},
			category: Categories.View,
			f1: true
		});
	}

	run(accessor: ServicesAccessor): void {
		accessor.get(IMenuService).resetHiddenStates();
		accessor.get(ILogService).info('did RESET all menu hidden states');
	}
}
