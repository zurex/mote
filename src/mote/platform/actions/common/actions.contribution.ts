/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMenuService, registerAction2 } from 'mote/platform/actions/common/actions';
import { MenuHiddenStatesReset } from 'mote/platform/actions/common/menuResetAction';
import { MenuService } from 'mote/platform/actions/common/menuService';
import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';

registerSingleton(IMenuService, MenuService, InstantiationType.Delayed);

registerAction2(MenuHiddenStatesReset);
