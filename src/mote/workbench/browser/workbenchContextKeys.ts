import { Disposable } from 'mote/base/common/lifecycle';
import { localize } from 'mote/nls';
import { IContextKeyService, RawContextKey } from 'mote/platform/contextkey/common/contextkey';
import { IsDevelopmentContext } from 'mote/platform/contextkey/common/contextkeys';
import { IWorkbenchEnvironmentService } from 'mote/workbench/services/environment/common/environmentService';

//#region < --- Side Bar --- >

export const SideBarVisibleContext = new RawContextKey<boolean>('sideBarVisible', false, localize('sideBarVisible', "Whether the sidebar is visible"));
export const SidebarFocusContext = new RawContextKey<boolean>('sideBarFocus', false, localize('sideBarFocus', "Whether the sidebar has keyboard focus"));
export const ActiveViewletContext = new RawContextKey<string>('activeViewlet', '', localize('activeViewlet', "The identifier of the active viewlet"));

//#endregion

export class WorkbenchContextKeysHandler extends Disposable {

	constructor(
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
	) {
		super();

		// Development
		IsDevelopmentContext.bindTo(this.contextKeyService).set(!this.environmentService.isBuilt || this.environmentService.isExtensionDevelopment);

	}
}
