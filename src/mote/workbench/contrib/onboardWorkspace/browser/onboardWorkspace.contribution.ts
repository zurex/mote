import { EditorPaneDescriptor, IEditorPaneRegistry } from 'mote/workbench/browser/editor';
import { EditorExtensions } from 'mote/workbench/common/editor';
import { OnboardWorkspacePage } from 'mote/workbench/contrib/onboardWorkspace/browser/onboardWorkspace';
import { OnboardWorkspaceInput } from 'mote/workbench/contrib/onboardWorkspace/browser/onboardWorkspaceInput';
import { localize } from 'mote/nls';
import { SyncDescriptor } from 'mote/platform/instantiation/common/descriptors';
import { Registry } from 'mote/platform/registry/common/platform';

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		OnboardWorkspacePage,
		OnboardWorkspacePage.ID,
		localize('onboardWorkspace', "Onboard Workspace")
	),
	[new SyncDescriptor(OnboardWorkspaceInput)]
);
