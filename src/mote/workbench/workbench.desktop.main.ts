/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


// #######################################################################
// ###                                                                 ###
// ### !!! PLEASE ADD COMMON IMPORTS INTO WORKBENCH.COMMON.MAIN.TS !!! ###
// ###                                                                 ###
// #######################################################################



//#region --- workbench common

import 'mote/workbench/workbench.common.main';

//#endregion

//#region --- workbench (desktop main)

import 'mote/workbench/electron-sandbox/desktop.main';
import 'mote/workbench/electron-sandbox/desktop.contribution';

//#endregion


//#region --- workbench services

import 'mote/workbench/services/textfile/electron-sandbox/nativeTextFileService';
import 'mote/workbench/services/lifecycle/browser/lifecycleService';
import 'mote/workbench/services/menubar/electron-sandbox/menubarService';
import 'mote/workbench/services/themes/electron-sandbox/nativeHostColorSchemeService';
import 'mote/workbench/services/host/electron-sandbox/nativeHostService';
import 'mote/workbench/services/timer/electron-sandbox/timerService';
import 'mote/workbench/services/accessibility/electron-sandbox/accessibilityService';
import 'mote/workbench/services/keybinding/electron-sandbox/nativeKeyboardLayout';
import 'mote/workbench/services/workspaces/browser/browserWorkspacesService';
import 'mote/workbench/services/title/electron-sandbox/titleService';
import 'mote/workbench/services/path/electron-sandbox/pathService';
import 'mote/workbench/services/update/electron-sandbox/updateService';

import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { ContextMenuService } from 'mote/platform/contextview/browser/contextMenuService';
import { IContextMenuService } from 'mote/platform/contextview/browser/contextView';
import { ITelemetryService } from 'mote/platform/telemetry/common/telemetry';
import { NullTelemetryServiceShape } from 'mote/platform/telemetry/common/telemetryUtils';


registerSingleton(IContextMenuService, ContextMenuService, InstantiationType.Delayed);
registerSingleton(ITelemetryService, NullTelemetryServiceShape, InstantiationType.Delayed);


//#endregion
