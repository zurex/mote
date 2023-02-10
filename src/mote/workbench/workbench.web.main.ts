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

import 'mote/workbench/browser/parts/dialogs/dialog.web.contribution';

//#region --- workbench (web main)

import 'mote/workbench/browser/web.main';

//#endregion

//#region --- workbench services

import 'mote/workbench/services/lifecycle/browser/lifecycleService';
import 'mote/workbench/services/keybinding/browser/browserKeyboardLayoutService';
import 'mote/workbench/services/textfile/browser/browserTextFileService';
import 'mote/workbench/services/themes/browser/browserHostColorSchemeService';
import 'mote/workbench/services/workspaces/browser/browserWorkspacesService';
import 'mote/workbench/services/host/browser/browserHostService';
import 'mote/workbench/services/path/browser/pathService';
import 'mote/workbench/services/update/browser/updateService';
import 'mote/workbench/services/progress/browser/progressService';

import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { IContextMenuService } from 'mote/platform/contextview/browser/contextView';
import { ContextMenuService } from 'mote/platform/contextview/browser/contextMenuService';
import { ITitleService } from 'mote/workbench/services/title/common/titleService';
import { TitlebarPart } from 'mote/workbench/browser/parts/titlebar/titlebarPart';
import { IAccessibilityService } from 'mote/platform/accessibility/common/accessibility';
import { AccessibilityService } from 'mote/platform/accessibility/browser/accessibilityService';
import { ITimerService, TimerService } from 'mote/workbench/services/timer/browser/timerService';
import { ICustomEndpointTelemetryService, ITelemetryService } from 'mote/platform/telemetry/common/telemetry';
import { NullEndpointTelemetryService, NullTelemetryServiceShape } from 'mote/platform/telemetry/common/telemetryUtils';


registerSingleton(IContextMenuService, ContextMenuService, InstantiationType.Delayed);
registerSingleton(ITitleService, TitlebarPart, InstantiationType.Eager);
registerSingleton(IAccessibilityService, AccessibilityService, InstantiationType.Delayed);
registerSingleton(ITimerService, TimerService, InstantiationType.Delayed);
registerSingleton(ICustomEndpointTelemetryService, NullEndpointTelemetryService, InstantiationType.Delayed);
registerSingleton(ITelemetryService, NullTelemetryServiceShape, InstantiationType.Delayed);


//#endregion


//#region --- workbench contributions

//#endregion


//#region --- export workbench factory

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//
// Do NOT change these exports in a way that something is removed unless
// intentional. These exports are used by web embedders and thus require
// an adoption when something changes.
//
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

import { create, } from 'mote/workbench/browser/web.factory';
import { IWorkbench, IWorkbenchConstructionOptions } from 'mote/workbench/browser/web.api';
import { ICredentialsProvider } from 'mote/platform/credentials/common/credentials';
// eslint-disable-next-line no-duplicate-imports
import type { IURLCallbackProvider } from 'mote/workbench/services/url/browser/urlService';
// eslint-disable-next-line no-duplicate-imports
import type { IWorkspace, IWorkspaceProvider } from 'mote/workbench/services/host/browser/browserHostService';

export {

	// Factory
	create,
	IWorkbenchConstructionOptions,
	IWorkbench,

	// Workspace
	IWorkspace,
	IWorkspaceProvider,

	// Credentials
	ICredentialsProvider,

	// Callbacks
	IURLCallbackProvider,
};
