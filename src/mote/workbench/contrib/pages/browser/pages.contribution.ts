import { IWorkbenchContributionsRegistry, WorkbenchExtensions } from 'mote/workbench/common/contributions';
import { LifecyclePhase } from 'mote/workbench/services/lifecycle/common/lifecycle';
import { Registry } from 'mote/platform/registry/common/platform';
import { ExplorerViewletViewsContribution } from './explorerViewlet';


// Register Explorer views
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ExplorerViewletViewsContribution, LifecyclePhase.Starting);
