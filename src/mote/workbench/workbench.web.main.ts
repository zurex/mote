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
import 'mote/workbench/services/themes/browser/browserHostColorSchemeService';

import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { IContextMenuService } from 'mote/platform/contextview/browser/contextView';
import { ContextMenuService } from 'mote/platform/contextview/browser/contextMenuService';

registerSingleton(IContextMenuService, ContextMenuService, InstantiationType.Delayed);

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
