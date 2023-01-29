import { IntlProvider } from 'mote/base/common/i18n';
import { EditorPaneDescriptor, IEditorPaneRegistry } from 'mote/workbench/browser/editor';
import { EditorExtensions } from 'mote/workbench/common/editor';
import { LoginPage } from 'mote/workbench/contrib/login/browser/login';
import { LoginInput } from 'mote/workbench/contrib/login/browser/loginInput';
import { SyncDescriptor } from 'mote/platform/instantiation/common/descriptors';
import { Registry } from 'mote/platform/registry/common/platform';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, WorkbenchExtensions } from 'mote/workbench/common/contributions';
import { IEditorGroupsService } from 'mote/workbench/services/editor/common/editorGroupsService';
import { IUserService } from 'mote/workbench/services/user/common/user';
import { IEditorService } from 'mote/workbench/services/editor/common/editorService';
import { LifecyclePhase } from 'mote/workbench/services/lifecycle/common/lifecycle';

class LoginContribution implements IWorkbenchContribution {

	constructor(
		@IEditorService editorService: IEditorService,
		@IEditorGroupsService editorGroupService: IEditorGroupsService,
		@IUserService userService: IUserService
	) {
		editorGroupService.whenReady.then(() => {
			if (!userService.currentProfile) {
				editorService.openEditor(new LoginInput());
			}
		});
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	LoginContribution, LifecyclePhase.Restored);


Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		LoginPage,
		LoginPage.ID,
		IntlProvider.INSTANCE.formatMessage({ id: 'login.title', defaultMessage: 'Login' })
	),
	[new SyncDescriptor(LoginInput)]
);
