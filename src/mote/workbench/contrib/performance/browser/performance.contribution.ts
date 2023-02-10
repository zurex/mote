/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'mote/nls';
import { registerAction2, Action2 } from 'mote/platform/actions/common/actions';
import { IInstantiationService, ServicesAccessor } from 'mote/platform/instantiation/common/instantiation';
import { LifecyclePhase } from 'mote/workbench/services/lifecycle/common/lifecycle';
import { Registry } from 'mote/platform/registry/common/platform';
import { Categories } from 'mote/platform/action/common/actionCommonCategories';
import { WorkbenchExtensions, IWorkbenchContributionsRegistry } from 'mote/workbench/common/contributions';
import { EditorExtensions, IEditorSerializer, IEditorFactoryRegistry } from 'mote/workbench/common/editor';
import { PerfviewContrib, PerfviewInput } from 'mote/workbench/contrib/performance/browser/perfviewEditor';
import { IEditorService } from 'mote/workbench/services/editor/common/editorService';
import { InstantiationService, Trace } from 'mote/platform/instantiation/common/instantiationService';
import { EventProfiling } from 'mote/base/common/event';
import { InputLatencyContrib } from 'mote/workbench/contrib/performance/browser/inputLatencyContrib';

// -- startup performance view

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	PerfviewContrib,
	LifecyclePhase.Ready
);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(
	PerfviewInput.Id,
	class implements IEditorSerializer {
		canSerialize(): boolean {
			return true;
		}
		serialize(): string {
			return '';
		}
		deserialize(instantiationService: IInstantiationService): PerfviewInput {
			return instantiationService.createInstance(PerfviewInput);
		}
	}
);


registerAction2(class extends Action2 {

	constructor() {
		super({
			id: 'perfview.show',
			title: { value: localize('show.label', "Startup Performance"), original: 'Startup Performance' },
			category: Categories.Developer,
			f1: true
		});
	}

	run(accessor: ServicesAccessor) {
		const editorService = accessor.get(IEditorService);
		const instaService = accessor.get(IInstantiationService);
		return editorService.openEditor(instaService.createInstance(PerfviewInput), { pinned: true });
	}
});


registerAction2(class PrintServiceCycles extends Action2 {

	constructor() {
		super({
			id: 'perf.insta.printAsyncCycles',
			title: { value: localize('cycles', "Print Service Cycles"), original: 'Print Service Cycles' },
			category: Categories.Developer,
			f1: true
		});
	}

	run(accessor: ServicesAccessor) {
		const instaService = accessor.get(IInstantiationService);
		if (instaService instanceof InstantiationService) {
			const cycle = instaService._globalGraph?.findCycleSlow();
			if (cycle) {
				console.warn(`CYCLE`, cycle);
			} else {
				console.warn(`YEAH, no more cycles`);
			}
		}
	}
});

registerAction2(class PrintServiceTraces extends Action2 {

	constructor() {
		super({
			id: 'perf.insta.printTraces',
			title: { value: localize('insta.trace', "Print Service Traces"), original: 'Print Service Traces' },
			category: Categories.Developer,
			f1: true
		});
	}

	run() {
		if (Trace.all.size === 0) {
			console.log('Enable via `instantiationService.ts#_enableAllTracing`');
			return;
		}

		for (const item of Trace.all) {
			console.log(item);
		}
	}
});


registerAction2(class PrintEventProfiling extends Action2 {

	constructor() {
		super({
			id: 'perf.event.profiling',
			title: { value: localize('emitter', "Print Emitter Profiles"), original: 'Print Emitter Profiles' },
			category: Categories.Developer,
			f1: true
		});
	}

	run(): void {
		if (EventProfiling.all.size === 0) {
			console.log('USE `EmitterOptions._profName` to enable profiling');
			return;
		}
		for (const item of EventProfiling.all) {
			console.log(`${item.name}: ${item.invocationCount} invocations COST ${item.elapsedOverall}ms, ${item.listenerCount} listeners, avg cost is ${item.durations.reduce((a, b) => a + b, 0) / item.durations.length}ms`);
		}
	}
});

// -- input latency

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	InputLatencyContrib,
	LifecyclePhase.Eventually
);
