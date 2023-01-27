import { Registry } from 'mote/platform/registry/common/platform';
import { EditorStatus } from 'mote/workbench/browser/parts/editor/editorStatus';
import { IWorkbenchContributionsRegistry, WorkbenchExtensions } from 'mote/workbench/common/contributions';
import { LifecyclePhase } from 'mote/workbench/services/lifecycle/common/lifecycle';

//#region Workbench Contributions
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(EditorStatus, LifecyclePhase.Ready);
