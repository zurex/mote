import 'mote/css!./workbench.common.main';

//#region --- editor/workbench core

import 'mote/editor/editor.all';

import 'mote/workbench/browser/workbench.contribution';

//#endregion

//#region --- workbench parts

import 'mote/workbench/browser/parts/editor/editor.contribution';
import 'mote/workbench/browser/parts/editor/editorPart';
import 'mote/workbench/browser/parts/paneCompositePart';
import 'mote/workbench/browser/parts/statusbar/statusbarPart';
import 'mote/workbench/browser/parts/views/viewsService';

//#endregion

//#region --- workbench services

import 'mote/platform/actions/common/actions.contribution';
import 'mote/platform/undoRedo/common/undoRedoService';
import 'mote/workbench/services/themes/browser/workbenchThemeService';
import 'mote/workbench/services/hover/browser/hoverService';
import 'mote/workbench/services/commands/common/commandService';
import 'mote/workbench/services/quickmenu/browser/quickmenuService';
import 'mote/workbench/services/views/browser/viewDescriptorService';
import 'mote/workbench/services/user/common/userService';
import 'mote/workbench/services/remote/browser/remoteService';
import 'mote/workbench/services/dialogs/common/dialogService';
import 'mote/workbench/services/workspaces/browser/workspacesService';
import 'mote/workbench/services/editor/browser/editorResolverService';
import 'mote/workbench/services/editor/browser/editorService';
import 'mote/workbench/services/editor/browser/moteEditorService';
import 'mote/workbench/services/keybinding/browser/keybindingService';
import 'mote/workbench/services/notification/common/notificationService';
import 'mote/workbench/services/quickinput/browser/workbenchQuickInputService';
import 'mote/workbench/services/textmodelResolver/common/textModelResolverService';
import 'mote/workbench/services/model/common/modelService';
import 'mote/workbench/services/textresourceProperties/common/textResourcePropertiesService';
import 'mote/workbench/services/activity/browser/activityService';
import 'mote/workbench/services/label/common/labelService';

//#endregion


import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { IContextViewService } from 'mote/platform/contextview/browser/contextView';
import { ContextViewService } from 'mote/platform/contextview/browser/contextViewService';
import { IStoreService } from 'mote/platform/store/common/store';
import { StoreService } from 'mote/platform/store/common/storeService';
import { IContextKeyService } from 'mote/platform/contextkey/common/contextkey';
import { ContextKeyService } from 'mote/platform/contextkey/browser/contextKeyService';
import { IListService, ListService } from 'mote/platform/list/browser/listService';
import { ITextResourceConfigurationService } from 'mote/editor/common/services/textResourceConfiguration';
import { TextResourceConfigurationService } from 'mote/editor/common/services/textResourceConfigurationService';
import { OpenerService } from 'mote/editor/browser/services/openerService';
import { IOpenerService } from 'mote/platform/opener/common/opener';


registerSingleton(IContextViewService, ContextViewService, InstantiationType.Delayed);
registerSingleton(IStoreService, StoreService, InstantiationType.Delayed);
registerSingleton(IContextKeyService, ContextKeyService, InstantiationType.Delayed);
registerSingleton(IListService, ListService, InstantiationType.Delayed);
registerSingleton(ITextResourceConfigurationService, TextResourceConfigurationService, InstantiationType.Delayed);
registerSingleton(IOpenerService, OpenerService, InstantiationType.Delayed);

//#region --- workbench contributions

// Explorer
import 'mote/workbench/contrib/pages/browser/explorerViewlet';
import 'mote/workbench/contrib/pages/browser/pages.contribution';

// DocumentEditor
import 'mote/workbench/contrib/documentEditor/browser/documentEditor.contribution';

// Login or Register
import 'mote/workbench/contrib/login/browser/login.contribution';

// Onboard Workspace
import 'mote/workbench/contrib/onboardWorkspace/browser/onboardWorkspace.contribution';

// Quickaccess
import 'mote/workbench/contrib/quickaccess/browser/quickAccess.contribution';

// Performance
import 'mote/workbench/contrib/performance/browser/performance.contribution';

//#endregion
