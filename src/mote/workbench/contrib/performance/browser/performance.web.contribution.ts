/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LifecyclePhase } from 'mote/workbench/services/lifecycle/common/lifecycle';
import { Registry } from 'mote/platform/registry/common/platform';
import { WorkbenchExtensions, IWorkbenchContributionsRegistry } from 'mote/workbench/common/contributions';
import { BrowserResourcePerformanceMarks, BrowserStartupTimings } from 'mote/workbench/contrib/performance/browser/startupTimings';

// -- startup timings

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	BrowserResourcePerformanceMarks,
	LifecyclePhase.Eventually
);

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	BrowserStartupTimings,
	LifecyclePhase.Eventually
);
