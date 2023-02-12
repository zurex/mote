/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ipcRenderer } from 'electron';
import { hostname, release } from 'os';
import { toErrorMessage } from 'mote/base/common/errorMessage';
import { onUnexpectedError, setUnexpectedErrorHandler } from 'mote/base/common/errors';
import { combinedDisposable, Disposable, toDisposable } from 'mote/base/common/lifecycle';
import { Schemas } from 'mote/base/common/network';
import { joinPath } from 'mote/base/common/resources';
import { URI } from 'mote/base/common/uri';
import { ProxyChannel, StaticRouter } from 'mote/base/parts/ipc/common/ipc';
import { Server as MessagePortServer } from 'mote/base/parts/ipc/electron-browser/ipc.mp';
import { IChecksumService } from 'mote/platform/checksum/common/checksumService';
import { ChecksumService } from 'mote/platform/checksum/node/checksumService';
import { IConfigurationService } from 'mote/platform/configuration/common/configuration';
import { ConfigurationService } from 'mote/platform/configuration/common/configurationService';
import { IDiagnosticsService } from 'mote/platform/diagnostics/common/diagnostics';
import { DiagnosticsService } from 'mote/platform/diagnostics/node/diagnosticsService';
import { IDownloadService } from 'mote/platform/download/common/download';
import { DownloadService } from 'mote/platform/download/common/downloadService';
import { INativeEnvironmentService } from 'mote/platform/environment/common/environment';
import { SharedProcessEnvironmentService } from 'mote/platform/sharedProcess/node/sharedProcessEnvironmentService';
import { IFileService } from 'mote/platform/files/common/files';
import { FileService } from 'mote/platform/files/common/fileService';
import { DiskFileSystemProvider } from 'mote/platform/files/node/diskFileSystemProvider';
import { SyncDescriptor } from 'mote/platform/instantiation/common/descriptors';
import { IInstantiationService, ServicesAccessor } from 'mote/platform/instantiation/common/instantiation';
import { InstantiationService } from 'mote/platform/instantiation/common/instantiationService';
import { ServiceCollection } from 'mote/platform/instantiation/common/serviceCollection';
import { MessagePortMainProcessService } from 'mote/platform/ipc/electron-browser/mainProcessService';
import { IMainProcessService } from 'mote/platform/ipc/electron-sandbox/services';
import { ILanguagePackService } from 'mote/platform/languagePacks/common/languagePacks';
import { NativeLanguagePackService } from 'mote/platform/languagePacks/node/languagePacks';
import { ConsoleLogger, ILoggerService, ILogService } from 'mote/platform/log/common/log';
import { LoggerChannelClient } from 'mote/platform/log/common/logIpc';
import { INativeHostService } from 'mote/platform/native/electron-sandbox/native';
import product from 'mote/platform/product/common/product';
import { IProductService } from 'mote/platform/product/common/productService';
import { IRequestService } from 'mote/platform/request/common/request';
import { ISharedProcessConfiguration } from 'mote/platform/sharedProcess/node/sharedProcess';
import { IStorageService } from 'mote/platform/storage/common/storage';
import { NativeStorageService } from 'mote/platform/storage/electron-sandbox/storageService';
import { resolveCommonProperties } from 'mote/platform/telemetry/common/commonProperties';
import { ICustomEndpointTelemetryService, ITelemetryService } from 'mote/platform/telemetry/common/telemetry';
import { TelemetryAppenderChannel } from 'mote/platform/telemetry/common/telemetryIpc';
import { TelemetryLogAppender } from 'mote/platform/telemetry/common/telemetryLogAppender';
import { TelemetryService } from 'mote/platform/telemetry/common/telemetryService';
import { supportsTelemetry, ITelemetryAppender, NullAppender, NullTelemetryService, getPiiPathsFromEnvironment, isInternalTelemetry } from 'mote/platform/telemetry/common/telemetryUtils';
import { CustomEndpointTelemetryService } from 'mote/platform/telemetry/node/customEndpointTelemetryService';
import { ISignService } from 'mote/platform/sign/common/sign';
import { SignService } from 'mote/platform/sign/node/signService';
import { ISharedProcessWorkerConfiguration, ISharedProcessWorkerService } from 'mote/platform/sharedProcess/common/sharedProcessWorkerService';
import { SharedProcessWorkerService } from 'mote/platform/sharedProcess/electron-browser/sharedProcessWorkerService';
import { IUriIdentityService } from 'mote/platform/uriIdentity/common/uriIdentity';
import { UriIdentityService } from 'mote/platform/uriIdentity/common/uriIdentityService';
import { isLinux } from 'mote/base/common/platform';
import { FileUserDataProvider } from 'mote/platform/userData/common/fileUserDataProvider';
import { DiskFileSystemProviderClient, LOCAL_FILE_SYSTEM_CHANNEL_NAME } from 'mote/platform/files/common/diskFileSystemProviderClient';
import { InspectProfilingService as V8InspectProfilingService } from 'mote/platform/profiling/node/profilingService';
import { IV8InspectProfilingService } from 'mote/platform/profiling/common/profiling';
import { IUserDataProfilesService } from 'mote/platform/userDataProfile/common/userDataProfile';
import { PolicyChannelClient } from 'mote/platform/policy/common/policyIpc';
import { IPolicyService, NullPolicyService } from 'mote/platform/policy/common/policy';
import { UserDataProfilesNativeService } from 'mote/platform/userDataProfile/electron-sandbox/userDataProfile';
import { SharedProcessRequestService } from 'mote/platform/request/electron-browser/sharedProcessRequestService';
import { OneDataSystemAppender } from 'mote/platform/telemetry/node/1dsAppender';
import { ISharedProcessLifecycleService, SharedProcessLifecycleService } from 'mote/platform/lifecycle/electron-browser/sharedProcessLifecycleService';
import { localize } from 'mote/nls';
import { LogService } from 'mote/platform/log/common/logService';

class SharedProcessMain extends Disposable {

	private server = this._register(new MessagePortServer());

	private sharedProcessWorkerService: ISharedProcessWorkerService | undefined = undefined;

	private lifecycleService: SharedProcessLifecycleService | undefined = undefined;

	constructor(private configuration: ISharedProcessConfiguration) {
		super();

		this.registerListeners();
	}

	private registerListeners(): void {

		// Shared process lifecycle
		const onExit = async () => {
			if (this.lifecycleService) {
				await this.lifecycleService.fireOnWillShutdown();
				this.lifecycleService.dispose();
				this.lifecycleService = undefined;
			}
			this.dispose();
		};
		process.once('exit', onExit);
		ipcRenderer.once('mote:electron-main->shared-process=exit', onExit);

		// Shared process worker lifecycle
		//
		// We dispose the listener when the shared process is
		// disposed to avoid disposing workers when the entire
		// application is shutting down anyways.
		//
		const eventName = 'mote:electron-main->shared-process=disposeWorker';
		const onDisposeWorker = (event: unknown, configuration: ISharedProcessWorkerConfiguration) => { this.onDisposeWorker(configuration); };
		ipcRenderer.on(eventName, onDisposeWorker);
		this._register(toDisposable(() => ipcRenderer.removeListener(eventName, onDisposeWorker)));
	}

	private onDisposeWorker(configuration: ISharedProcessWorkerConfiguration): void {
		this.sharedProcessWorkerService?.disposeWorker(configuration);
	}

	async open(): Promise<void> {

		// Services
		const instantiationService = await this.initServices();

		// Config
		registerUserDataSyncConfiguration();

		instantiationService.invokeFunction(accessor => {
			const logService = accessor.get(ILogService);

			// Log info
			logService.trace('sharedProcess configuration', JSON.stringify(this.configuration));

			// Channels
			this.initChannels(accessor);

			// Error handler
			this.registerErrorHandler(logService);
		});

		// Instantiate Contributions
		this._register(combinedDisposable(
		));
	}

	private async initServices(): Promise<IInstantiationService> {
		const services = new ServiceCollection();

		// Lifecycle

		// Product
		const productService = { _serviceBrand: undefined, ...product };
		services.set(IProductService, productService);

		// Main Process
		const mainRouter = new StaticRouter(ctx => ctx === 'main');
		const mainProcessService = new MessagePortMainProcessService(this.server, mainRouter);
		services.set(IMainProcessService, mainProcessService);

		// Policies
		const policyService = this.configuration.policiesData ? new PolicyChannelClient(this.configuration.policiesData, mainProcessService.getChannel('policy')) : new NullPolicyService();
		services.set(IPolicyService, policyService);

		// Environment
		const environmentService = new SharedProcessEnvironmentService(this.configuration.args, productService);
		services.set(INativeEnvironmentService, environmentService);

		// Logger
		const loggerService = new LoggerChannelClient(undefined, this.configuration.logLevel, this.configuration.loggers, mainProcessService.getChannel('logger'));
		services.set(ILoggerService, loggerService);

		// Log
		const logger = this._register(loggerService.createLogger(joinPath(URI.file(environmentService.logsPath), 'sharedprocess.log'), { id: 'sharedLog', name: localize('sharedLog', "Shared") }));
		const consoleLogger = this._register(new ConsoleLogger(this.configuration.logLevel));
		const logService = this._register(new LogService(logger, [consoleLogger]));
		services.set(ILogService, logService);

		// Lifecycle
		this.lifecycleService = new SharedProcessLifecycleService(logService);
		services.set(ISharedProcessLifecycleService, this.lifecycleService);

		// Worker
		this.sharedProcessWorkerService = new SharedProcessWorkerService(logService);
		services.set(ISharedProcessWorkerService, this.sharedProcessWorkerService);

		// Files
		const fileService = this._register(new FileService(logService));
		services.set(IFileService, fileService);

		const diskFileSystemProvider = this._register(new DiskFileSystemProvider(logService));
		fileService.registerProvider(Schemas.file, diskFileSystemProvider);

		const userDataFileSystemProvider = this._register(new FileUserDataProvider(
			Schemas.file,
			// Specifically for user data, use the disk file system provider
			// from the main process to enable atomic read/write operations.
			// Since user data can change very frequently across multiple
			// processes, we want a single process handling these operations.
			this._register(new DiskFileSystemProviderClient(mainProcessService.getChannel(LOCAL_FILE_SYSTEM_CHANNEL_NAME), { pathCaseSensitive: isLinux })),
			Schemas.moteUserData,
			logService
		));
		fileService.registerProvider(Schemas.moteUserData, userDataFileSystemProvider);

		// User Data Profiles
		const userDataProfilesService = this._register(new UserDataProfilesNativeService(this.configuration.profiles, mainProcessService, environmentService));
		services.set(IUserDataProfilesService, userDataProfilesService);

		// Configuration
		const configurationService = this._register(new ConfigurationService(userDataProfilesService.defaultProfile.settingsResource, fileService, policyService, logService));
		services.set(IConfigurationService, configurationService);

		// Storage (global access only)
		const storageService = new NativeStorageService(undefined, { defaultProfile: userDataProfilesService.defaultProfile, currentProfile: userDataProfilesService.defaultProfile }, mainProcessService, environmentService);
		services.set(IStorageService, storageService);
		this._register(toDisposable(() => storageService.flush()));

		// Initialize config & storage in parallel
		await Promise.all([
			configurationService.initialize(),
			storageService.initialize()
		]);

		// URI Identity
		const uriIdentityService = new UriIdentityService(fileService);
		services.set(IUriIdentityService, uriIdentityService);

		// Request
		services.set(IRequestService, new SharedProcessRequestService(mainProcessService, configurationService, productService, logService));

		// Checksum
		services.set(IChecksumService, new SyncDescriptor(ChecksumService, undefined, false /* proxied to other processes */));

		// V8 Inspect profiler
		services.set(IV8InspectProfilingService, new SyncDescriptor(V8InspectProfilingService, undefined, false /* proxied to other processes */));

		// Native Host
		const nativeHostService = ProxyChannel.toService<INativeHostService>(mainProcessService.getChannel('nativeHost'), { context: this.configuration.windowId });
		services.set(INativeHostService, nativeHostService);

		// Download
		services.set(IDownloadService, new SyncDescriptor(DownloadService, undefined, true));

		// Telemetry
		let telemetryService: ITelemetryService;
		const appenders: ITelemetryAppender[] = [];
		const internalTelemetry = isInternalTelemetry(productService, configurationService);
		if (supportsTelemetry(productService, environmentService)) {
			const logAppender = new TelemetryLogAppender(logService, loggerService, environmentService, productService);
			appenders.push(logAppender);
			const { installSourcePath } = environmentService;
			if (productService.aiConfig?.ariaKey) {
				const collectorAppender = new OneDataSystemAppender(internalTelemetry, 'monacoworkbench', null, productService.aiConfig.ariaKey);
				this._register(toDisposable(() => collectorAppender.flush())); // Ensure the 1DS appender is disposed so that it flushes remaining data
				appenders.push(collectorAppender);
			}

			telemetryService = new TelemetryService({
				appenders,
				commonProperties: resolveCommonProperties(fileService, release(), hostname(), process.arch, productService.commit, productService.version, this.configuration.machineId, internalTelemetry, installSourcePath),
				sendErrorTelemetry: true,
				piiPaths: getPiiPathsFromEnvironment(environmentService),
			}, configurationService, productService);
		} else {
			telemetryService = NullTelemetryService;
			const nullAppender = NullAppender;
			appenders.push(nullAppender);
		}

		this.server.registerChannel('telemetryAppender', new TelemetryAppenderChannel(appenders));
		services.set(ITelemetryService, telemetryService);

		// Custom Endpoint Telemetry
		const customEndpointTelemetryService = new CustomEndpointTelemetryService(configurationService, telemetryService, logService, loggerService, environmentService, productService);
		services.set(ICustomEndpointTelemetryService, customEndpointTelemetryService);

		// Localizations
		services.set(ILanguagePackService, new SyncDescriptor(NativeLanguagePackService, undefined, false /* proxied to other processes */));

		// Diagnostics
		services.set(IDiagnosticsService, new SyncDescriptor(DiagnosticsService, undefined, false /* proxied to other processes */));

		// Signing
		services.set(ISignService, new SyncDescriptor(SignService, undefined, false /* proxied to other processes */));

		return new InstantiationService(services);
	}

	private initChannels(accessor: ServicesAccessor): void {
	}

	private registerErrorHandler(logService: ILogService): void {

		// Listen on unhandled rejection events
		window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {

			// See https://developer.mozilla.org/en-US/docs/Web/API/PromiseRejectionEvent
			onUnexpectedError(event.reason);

			// Prevent the printing of this event to the console
			event.preventDefault();
		});

		// Install handler for unexpected errors
		setUnexpectedErrorHandler(error => {
			const message = toErrorMessage(error, true);
			if (!message) {
				return;
			}

			logService.error(`[uncaught exception in sharedProcess]: ${message}`);
		});
	}
}

export async function main(configuration: ISharedProcessConfiguration): Promise<void> {

	// create shared process and signal back to main that we are
	// ready to accept message ports as client connections
	const sharedProcess = new SharedProcessMain(configuration);
	ipcRenderer.send('mote:shared-process->electron-main=ipc-ready');

	// await initialization and signal this back to electron-main
	await sharedProcess.open();
	ipcRenderer.send('mote:shared-process->electron-main=init-done');
}
