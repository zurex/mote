/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { TitlebarPart } from 'mote/workbench/electron-sandbox/parts/titlebar/titlebarPart';
import { ITitleService } from 'mote/workbench/services/title/common/titleService';

registerSingleton(ITitleService, TitlebarPart, InstantiationType.Eager);
