/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'mote/nls';
import { process } from 'mote/base/parts/sandbox/electron-sandbox/globals';
import { AbstractTextFileService } from 'mote/workbench/services/textfile/browser/textFileService';
import { ITextFileService, ITextFileStreamContent, ITextFileContent, IReadTextFileOptions, TextFileEditorModelState, ITextFileEditorModel } from 'mote/workbench/services/textfile/common/textfiles';
import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { URI } from 'mote/base/common/uri';
import { IFileService, ByteSize, getPlatformFileLimits, Arch, IFileReadLimits } from 'mote/platform/files/common/files';
import { ITextResourceConfigurationService } from 'mote/editor/common/services/textResourceConfiguration';
import { ILifecycleService } from 'mote/workbench/services/lifecycle/common/lifecycle';
import { IInstantiationService } from 'mote/platform/instantiation/common/instantiation';
import { IModelService } from 'mote/editor/common/services/model';
import { INativeWorkbenchEnvironmentService } from 'mote/workbench/services/environment/electron-sandbox/environmentService';
import { IDialogService, IFileDialogService } from 'mote/platform/dialogs/common/dialogs';
import { IFilesConfigurationService } from 'mote/workbench/services/filesConfiguration/common/filesConfigurationService';
import { IMoteEditorService } from 'mote/editor/browser/services/moteEditorService';
import { IPathService } from 'mote/workbench/services/path/common/pathService';
import { IWorkingCopyFileService } from 'mote/workbench/services/workingCopy/common/workingCopyFileService';
import { IUriIdentityService } from 'mote/platform/uriIdentity/common/uriIdentity';
import { ILogService } from 'mote/platform/log/common/log';
import { Promises } from 'mote/base/common/async';

export class NativeTextFileService extends AbstractTextFileService {

	protected override readonly environmentService: INativeWorkbenchEnvironmentService;

	constructor(
		@IFileService fileService: IFileService,
		@ILifecycleService lifecycleService: ILifecycleService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IModelService modelService: IModelService,
		@INativeWorkbenchEnvironmentService environmentService: INativeWorkbenchEnvironmentService,
		@IDialogService dialogService: IDialogService,
		//@IFileDialogService fileDialogService: IFileDialogService,
		@ITextResourceConfigurationService textResourceConfigurationService: ITextResourceConfigurationService,
		@IFilesConfigurationService filesConfigurationService: IFilesConfigurationService,
		@IMoteEditorService moteEditorService: IMoteEditorService,
		@IPathService pathService: IPathService,
		@IWorkingCopyFileService workingCopyFileService: IWorkingCopyFileService,
		@IUriIdentityService uriIdentityService: IUriIdentityService,
		@ILogService logService: ILogService,
	) {
		super(
			fileService, lifecycleService, instantiationService, modelService,
			environmentService, dialogService, null as any,
			textResourceConfigurationService, filesConfigurationService,
			moteEditorService, pathService, workingCopyFileService,
			uriIdentityService, logService, null as any
		);

		this.environmentService = environmentService;

		this.registerListeners();
	}

	private registerListeners(): void {

		// Lifecycle
		this.lifecycleService.onWillShutdown(event => event.join(this.onWillShutdown(), { id: 'join.textFiles', label: localize('join.textFiles', "Saving text files") }));
	}

	private async onWillShutdown(): Promise<void> {
		let modelsPendingToSave: ITextFileEditorModel[];

		// As long as models are pending to be saved, we prolong the shutdown
		// until that has happened to ensure we are not shutting down in the
		// middle of writing to the file
		// (https://github.com/microsoft/vscode/issues/116600)
		while ((modelsPendingToSave = this.files.models.filter(model => model.hasState(TextFileEditorModelState.PENDING_SAVE))).length > 0) {
			await Promises.settled(modelsPendingToSave.map(model => model.joinState(TextFileEditorModelState.PENDING_SAVE)));
		}
	}

	override async read(resource: URI, options?: IReadTextFileOptions): Promise<ITextFileContent> {

		// ensure --max-memory limit is applied
		options = this.ensureLimits(options);

		return super.read(resource, options);
	}

	override async readStream(resource: URI, options?: IReadTextFileOptions): Promise<ITextFileStreamContent> {

		// ensure --max-memory limit is applied
		options = this.ensureLimits(options);

		return super.readStream(resource, options);
	}

	private ensureLimits(options?: IReadTextFileOptions): IReadTextFileOptions {
		let ensuredOptions: IReadTextFileOptions;
		if (!options) {
			ensuredOptions = Object.create(null);
		} else {
			ensuredOptions = options;
		}

		let ensuredLimits: IFileReadLimits;
		if (!ensuredOptions.limits) {
			ensuredLimits = Object.create(null);
			ensuredOptions = {
				...ensuredOptions,
				limits: ensuredLimits
			};
		} else {
			ensuredLimits = ensuredOptions.limits;
		}

		if (typeof ensuredLimits.memory !== 'number') {
			const maxMemory = this.environmentService.args['max-memory'];
			ensuredLimits.memory = Math.max(typeof maxMemory === 'string' ? parseInt(maxMemory) * ByteSize.MB || 0 : 0, getPlatformFileLimits(process.arch === 'ia32' ? Arch.IA32 : Arch.OTHER).maxHeapSize);
		}

		return ensuredOptions;
	}
}

registerSingleton(ITextFileService, NativeTextFileService, InstantiationType.Eager);
