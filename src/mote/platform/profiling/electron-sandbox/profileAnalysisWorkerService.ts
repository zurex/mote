/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { DefaultWorkerFactory } from 'mote/base/browser/defaultWorkerFactory';
import { URI } from 'mote/base/common/uri';
import { SimpleWorkerClient } from 'mote/base/common/worker/simpleWorker';
import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { createDecorator } from 'mote/platform/instantiation/common/instantiation';
import { ILogService } from 'mote/platform/log/common/log';
import { IV8Profile } from 'mote/platform/profiling/common/profiling';
import { BottomUpSample } from 'mote/platform/profiling/common/profilingModel';
import { reportSample } from 'mote/platform/profiling/common/profilingTelemetrySpec';
import { ITelemetryService } from 'mote/platform/telemetry/common/telemetry';


export const enum ProfilingOutput {
	Failure,
	Irrelevant,
	Interesting,
}

export interface IScriptUrlClassifier {
	(scriptUrl: string): string;
}

export const IProfileAnalysisWorkerService = createDecorator<IProfileAnalysisWorkerService>('IProfileAnalysisWorkerService');

export interface IProfileAnalysisWorkerService {
	readonly _serviceBrand: undefined;
	analyseBottomUp(profile: IV8Profile, callFrameClassifier: IScriptUrlClassifier, perfBaseline: number): Promise<ProfilingOutput>;
	analyseByLocation(profile: IV8Profile, locations: [location: URI, id: string][]): Promise<[category: string, aggregated: number][]>;
}


// ---- impl

class ProfileAnalysisWorkerService implements IProfileAnalysisWorkerService {

	declare _serviceBrand: undefined;

	private readonly _workerFactory = new DefaultWorkerFactory('CpuProfileAnalysis');

	constructor(
		@ITelemetryService private readonly _telemetryService: ITelemetryService,
		@ILogService private readonly _logService: ILogService,
	) { }

	private async _withWorker<R>(callback: (worker: Proxied<IProfileAnalysisWorker>) => Promise<R>): Promise<R> {

		const worker = new SimpleWorkerClient<Proxied<IProfileAnalysisWorker>, {}>(
			this._workerFactory,
			'mote/platform/profiling/electron-sandbox/profileAnalysisWorker',
			{ /* host */ }
		);

		try {
			const r = await callback(await worker.getProxyObject());
			return r;
		} finally {
			worker.dispose();
		}
	}

	async analyseBottomUp(profile: IV8Profile, callFrameClassifier: IScriptUrlClassifier, perfBaseline: number): Promise<ProfilingOutput> {
		return this._withWorker(async worker => {
			const result = await worker.analyseBottomUp(profile);
			if (result.kind === ProfilingOutput.Interesting) {
				for (const sample of result.samples) {
					reportSample({
						sample,
						perfBaseline,
						source: callFrameClassifier(sample.url)
					}, this._telemetryService, this._logService);
				}
			}
			return result.kind;
		});
	}

	async analyseByLocation(profile: IV8Profile, locations: [location: URI, id: string][]): Promise<[category: string, aggregated: number][]> {
		return this._withWorker(async worker => {
			const result = await worker.analyseByUrlCategory(profile, locations);
			return result;
		});
	}
}

// ---- worker contract

export interface BottomUpAnalysis {
	kind: ProfilingOutput;
	samples: BottomUpSample[];
}

export interface CategoryAnalysis {
	category: string;
	percentage: number;
	aggregated: number;
	overallDuration: number;
}

export interface IProfileAnalysisWorker {
	analyseBottomUp(profile: IV8Profile): BottomUpAnalysis;
	analyseByUrlCategory(profile: IV8Profile, categories: [url: URI, category: string][]): [category: string, aggregated: number][];
}

// TODO@jrieken move into worker logic
type Proxied<T> = { [K in keyof T]: T[K] extends (...args: infer A) => infer R
	? (...args: A) => Promise<Awaited<R>>
	: never
};


registerSingleton(IProfileAnalysisWorkerService, ProfileAnalysisWorkerService, InstantiationType.Delayed);
