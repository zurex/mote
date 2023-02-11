import { localize } from 'mote/nls';
import { SyncDescriptor } from 'mote/platform/instantiation/common/descriptors';
import { Registry } from 'mote/platform/registry/common/platform';
import { EditorPaneDescriptor, IEditorPaneRegistry } from 'mote/workbench/browser/editor';
import { EditorStatus } from 'mote/workbench/browser/parts/editor/editorStatus';
import { TextResourceEditor } from 'mote/workbench/browser/parts/editor/textResourceEditor';
import { IWorkbenchContributionsRegistry, WorkbenchExtensions } from 'mote/workbench/common/contributions';
import { EditorExtensions } from 'mote/workbench/common/editor';
import { TextResourceEditorInput } from 'mote/workbench/common/editor/textResourceEditorInput';
import { LifecyclePhase } from 'mote/workbench/services/lifecycle/common/lifecycle';

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		TextResourceEditor,
		TextResourceEditor.ID,
		localize('textEditor', "Text Editor"),
	),
	[
		new SyncDescriptor(TextResourceEditorInput)
	]
);

//#region Workbench Contributions
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(EditorStatus, LifecyclePhase.Ready);
