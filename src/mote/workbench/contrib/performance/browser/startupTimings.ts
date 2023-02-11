/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isMoteEditor } from 'mote/editor/browser/editorBrowser';
import { ILifecycleService, StartupKind, StartupKindToString } from 'mote/workbench/services/lifecycle/common/lifecycle';
import { IUpdateService } from 'mote/platform/update/common/update';
import * as files from 'mote/workbench/contrib/pages/common/files';
import { IEditorService } from 'mote/workbench/services/editor/common/editorService';
//import { IWorkspaceTrustManagementService } from 'mote/platform/workspace/common/workspaceTrust';
import { IPaneCompositePartService } from 'mote/workbench/services/panecomposite/browser/panecomposite';
import { ViewContainerLocation } from 'mote/workbench/common/views';
import { ILogService } from 'mote/platform/log/common/log';
import { IProductService } from 'mote/platform/product/common/productService';
import { ITelemetryService } from 'mote/platform/telemetry/common/telemetry';
import { IBrowserWorkbenchEnvironmentService } from 'mote/workbench/services/environment/browser/environmentService';
import { ITimerService } from 'mote/workbench/services/timer/browser/timerService';
import { IWorkbenchContribution } from 'mote/workbench/common/contributions';
import { posix } from 'mote/base/common/path';
import { hash } from 'mote/base/common/hash';

export abstract class StartupTimings {

	constructor(
		@IEditorService private readonly _editorService: IEditorService,
		@IPaneCompositePartService private readonly _paneCompositeService: IPaneCompositePartService,
		@ILifecycleService private readonly _lifecycleService: ILifecycleService,
		@IUpdateService private readonly _updateService: IUpdateService,
		//@IWorkspaceTrustManagementService private readonly _workspaceTrustService: IWorkspaceTrustManagementService
	) {
	}

	protected async _isStandardStartup(): Promise<string | undefined> {
		// check for standard startup:
		// * new window (no reload)
		// * workspace is trusted
		// * just one window
		// * explorer viewlet visible
		// * one text editor (not multiple, not webview, welcome etc...)
		// * cached data present (not rejected, not created)
		if (this._lifecycleService.startupKind !== StartupKind.NewWindow) {
			return StartupKindToString(this._lifecycleService.startupKind);
		}

		const activeViewlet = this._paneCompositeService.getActivePaneComposite(ViewContainerLocation.Sidebar);
		if (!activeViewlet || activeViewlet.getId() !== files.FILES_VIEWLET_ID) {
			return 'Explorer viewlet not visible';
		}
		const visibleEditorPanes = this._editorService.visibleEditorPanes;
		if (visibleEditorPanes.length !== 1) {
			return `Expected text editor count : 1, Actual : ${visibleEditorPanes.length}`;
		}
		if (!isMoteEditor(visibleEditorPanes[0].getControl())) {
			return 'Active editor is not a text editor';
		}
		const activePanel = this._paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel);
		if (activePanel) {
			return `Current active panel : ${this._paneCompositeService.getPaneComposite(activePanel.getId(), ViewContainerLocation.Panel)?.name}`;
		}
		const isLatestVersion = await this._updateService.isLatestVersion();
		if (isLatestVersion === false) {
			return 'Not on latest version, updates available';
		}
		return undefined;
	}
}

export class BrowserStartupTimings extends StartupTimings implements IWorkbenchContribution {

	constructor(
		@IEditorService editorService: IEditorService,
		@IPaneCompositePartService paneCompositeService: IPaneCompositePartService,
		@ILifecycleService lifecycleService: ILifecycleService,
		@IUpdateService updateService: IUpdateService,
		//@IWorkspaceTrustManagementService workspaceTrustService: IWorkspaceTrustManagementService,
		@ITimerService private readonly timerService: ITimerService,
		@ILogService private readonly logService: ILogService,
		@IBrowserWorkbenchEnvironmentService private readonly environmentService: IBrowserWorkbenchEnvironmentService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IProductService private readonly productService: IProductService
	) {
		super(editorService, paneCompositeService, lifecycleService, updateService);

		this.logPerfMarks();
	}

	private async logPerfMarks(): Promise<void> {
		if (!this.environmentService.profDurationMarkers) {
			return;
		}

		await this.timerService.whenReady();

		const standardStartupError = await this._isStandardStartup();
		const perfBaseline = await this.timerService.perfBaseline;
		const { sessionId } = await this.telemetryService.getTelemetryInfo();
		const [from, to] = this.environmentService.profDurationMarkers;
		const content = `${this.timerService.getDuration(from, to)}\t${this.productService.nameShort}\t${(this.productService.commit || '').slice(0, 10) || '0000000000'}\t${sessionId}\t${standardStartupError === undefined ? 'standard_start' : 'NO_standard_start : ' + standardStartupError}\t${String(perfBaseline).padStart(4, '0')}ms\n`;

		this.logService.info(`[prof-timers] ${content}`);
	}
}

export class BrowserResourcePerformanceMarks {

	constructor(
		@ITelemetryService telemetryService: ITelemetryService
	) {

		type Entry = {
			hosthash: string;
			name: string;
			duration: number;
		};
		type EntryClassifify = {
			owner: 'jrieken';
			comment: 'Resource performance numbers';
			hosthash: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'Hash of the hostname' };
			name: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'Resource basename' };
			duration: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Resource duration' };
		};
		for (const item of performance.getEntriesByType('resource')) {

			try {
				const url = new URL(item.name);
				const name = posix.basename(url.pathname);

				telemetryService.publicLog2<Entry, EntryClassifify>('startup.resource.perf', {
					hosthash: `H${hash(url.host).toString(16)}`,
					name,
					duration: item.duration
				});
			} catch {
				// ignore
			}
		}
	}
}
