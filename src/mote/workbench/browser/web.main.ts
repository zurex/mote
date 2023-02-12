/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { domContentLoaded, detectFullscreen, getCookieValue } from 'mote/base/browser/dom';
import { ServiceCollection } from 'mote/platform/instantiation/common/serviceCollection';
import { ILogService, ConsoleLogger, LogLevel, ILoggerService } from 'mote/platform/log/common/log';
import { Disposable, DisposableStore, toDisposable } from 'mote/base/common/lifecycle';
import { BrowserWorkbenchEnvironmentService, IBrowserWorkbenchEnvironmentService } from 'mote/workbench/services/environment/browser/environmentService';
import { Workbench } from 'mote/workbench/browser/workbench';
import { IWorkbenchEnvironmentService } from 'mote/workbench/services/environment/common/environmentService';
import { IProductService } from 'mote/platform/product/common/productService';
import product from 'mote/platform/product/common/product';
import { RemoteAuthorityResolverService } from 'mote/platform/remote/browser/remoteAuthorityResolverService';
import { IRemoteAuthorityResolverService } from 'mote/platform/remote/common/remoteAuthorityResolver';
import { IWorkbenchFileService } from 'mote/workbench/services/files/common/files';
import { FileService } from 'mote/platform/files/common/fileService';
import { Schemas, connectionTokenCookieName } from 'mote/base/common/network';
import { onUnexpectedError } from 'mote/base/common/errors';
import { setFullscreen } from 'mote/base/browser/browser';
import { URI } from 'mote/base/common/uri';
import { ISignService } from 'mote/platform/sign/common/sign';
import { SignService } from 'mote/platform/sign/browser/signService';
import { IWorkbenchConstructionOptions, IWorkbench } from 'mote/workbench/browser/web.api';
import { BrowserStorageService } from 'mote/workbench/services/storage/browser/storageService';
import { IStorageService } from 'mote/platform/storage/common/storage';
import { FileLoggerService } from 'mote/platform/log/common/fileLog';
import { toLocalISOString } from 'mote/base/common/date';
import { isWorkspaceToOpen, isFolderToOpen } from 'mote/platform/window/common/window';
import { getSingleFolderWorkspaceIdentifier, getWorkspaceIdentifier } from 'mote/workbench/services/workspaces/browser/workspaces';
import { InMemoryFileSystemProvider } from 'mote/platform/files/common/inMemoryFilesystemProvider';
import { ICommandService } from 'mote/platform/commands/common/commands';
import { IndexedDBFileSystemProvider } from 'mote/platform/files/browser/indexedDBFileSystemProvider';
import { ILifecycleService } from 'mote/workbench/services/lifecycle/common/lifecycle';
import { IInstantiationService } from 'mote/platform/instantiation/common/instantiation';
import { localize } from 'mote/nls';
import { BrowserWindow } from 'mote/workbench/browser/window';
import { HTMLFileSystemProvider } from 'mote/platform/files/browser/htmlFileSystemProvider';
import { mixin, safeStringify } from 'mote/base/common/objects';
import { IndexedDB } from 'mote/base/browser/indexedDB';
import { IWorkspace } from 'mote/workbench/services/host/browser/browserHostService';
import { WebFileSystemAccess } from 'mote/platform/files/browser/webFileSystemAccess';
import { DelayedLogChannel } from 'mote/workbench/services/output/common/delayedLogChannel';
import { dirname, joinPath } from 'mote/base/common/resources';
import { UserService } from 'mote/workbench/services/user/common/userService';
import { RemoteService } from 'mote/workbench/services/remote/browser/remoteService';
import { IRemoteService } from 'mote/platform/remote/common/remote';
import { IUserService } from 'mote/workbench/services/user/common/user';
import { IWorkbenchConfigurationService } from 'mote/workbench/services/configuration/common/workbenchConfiguration';
import { WorkbenchConfigurationService } from 'mote/workbench/services/configuration/browser/workbenchConfigurationService';
import { LogService } from 'mote/platform/log/common/logService';
import { BufferLogger } from 'mote/platform/log/common/bufferLog';
import { rendererLogId } from 'mote/workbench/common/logConstants';
import { NullPolicyService } from 'mote/platform/policy/common/policy';
import { ConfigurationCache } from 'mote/workbench/services/configuration/common/configurationCache';
import { UriIdentityService } from 'mote/platform/uriIdentity/common/uriIdentityService';
import { IUriIdentityService } from 'mote/platform/uriIdentity/common/uriIdentity';

export class BrowserMain extends Disposable {

	private readonly onWillShutdownDisposables = this._register(new DisposableStore());
	private readonly indexedDBFileSystemProviders: IndexedDBFileSystemProvider[] = [];

	constructor(
		private readonly domElement: HTMLElement,
		private readonly configuration: IWorkbenchConstructionOptions
	) {
		super();

		this.init();
	}

	private init(): void {

		// Browser config
		setFullscreen(!!detectFullscreen());
	}

	async open(): Promise<IWorkbench> {

		// Init services and wait for DOM to be ready in parallel
		const [services] = await Promise.all([this.initServices(), domContentLoaded()]);

		// Create Workbench
		const workbench = new Workbench(this.domElement, undefined, services.serviceCollection, services.logService);

		// Listeners
		this.registerListeners(workbench);

		// Startup
		const instantiationService = workbench.startup();

		// Window
		this._register(instantiationService.createInstance(BrowserWindow));

		// Logging
		services.logService.trace('workbench#open with configuration', safeStringify(this.configuration));

		// Return API Facade
		return instantiationService.invokeFunction(accessor => {
			const commandService = accessor.get(ICommandService);
			const lifecycleService = accessor.get(ILifecycleService);
			//const openerService = accessor.get(IOpenerService);
			const productService = accessor.get(IProductService);
			//const telemetryService = accessor.get(ITelemetryService);
			//const progessService = accessor.get(IProgressService);
			const environmentService = accessor.get(IBrowserWorkbenchEnvironmentService);
			const instantiationService = accessor.get(IInstantiationService);
			//const remoteExplorerService = accessor.get(IRemoteExplorerService);
			//const labelService = accessor.get(ILabelService);

			let logger: DelayedLogChannel | undefined = undefined;

			return {
				commands: {
					executeCommand: (command, ...args) => commandService.executeCommand(command, ...args)
				},
				env: {
					telemetryLevel: null as any,//telemetryService.telemetryLevel,
					async getUriScheme(): Promise<string> {
						return productService.urlProtocol;
					},
					async openUri(uri: URI): Promise<boolean> {
						return Promise.resolve(true); //openerService.open(uri, {});
					}
				},
				logger: {
					log: (level, message) => {
						if (!logger) {
							logger = instantiationService.createInstance(DelayedLogChannel, 'webEmbedder', productService.embedderIdentifier || productService.nameShort, joinPath(dirname(environmentService.logFile), 'webEmbedder.log'));
						}
						logger.log(level, message);
					}
				},
				window: {
					withProgress: (options, task) => null as any//progessService.withProgress(options, task)
				},
				shutdown: () => lifecycleService.shutdown(),
			};
		});
	}

	private registerListeners(workbench: Workbench): void {

		// Workbench Lifecycle
		//this._register(workbench.onWillShutdown(() => this.onWillShutdownDisposables.clear()));
		//this._register(workbench.onDidShutdown(() => this.dispose()));
	}

	private async initServices(): Promise<{ serviceCollection: ServiceCollection; logService: ILogService }> {
		const serviceCollection = new ServiceCollection();


		// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
		//
		// NOTE: Please do NOT register services here. Use `registerSingleton()`
		//       from `workbench.common.main.ts` if the service is shared between
		//       desktop and web or `workbench.web.main.ts` if the service
		//       is web only.
		//
		// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!


		const payload = this.resolveWorkspaceInitializationPayload();

		// Product
		const productService: IProductService = mixin({ _serviceBrand: undefined, ...product }, this.configuration.productConfiguration);
		serviceCollection.set(IProductService, productService);

		// Environment
		const logsPath = URI.file(toLocalISOString(new Date()).replace(/-|:|\.\d+Z$/g, '')).with({ scheme: 'mote-log' });
		const environmentService = new BrowserWorkbenchEnvironmentService(payload.id, logsPath, this.configuration, productService);
		serviceCollection.set(IBrowserWorkbenchEnvironmentService, environmentService);

		// Log
		//getLogLevel(environmentService);
		const logLevel = LogLevel.Debug;
		const bufferLogger = new BufferLogger(logLevel);
		const otherLoggers = [new ConsoleLogger(logLevel)];
		const logService = new LogService(bufferLogger, otherLoggers);
		serviceCollection.set(ILogService, logService);

		// Remote
		const connectionToken = environmentService.options.connectionToken || getCookieValue(connectionTokenCookieName);
		const remoteAuthorityResolverService = new RemoteAuthorityResolverService(connectionToken, this.configuration.resourceUriProvider, productService, logService);
		serviceCollection.set(IRemoteAuthorityResolverService, remoteAuthorityResolverService);

		// Signing
		const signService = new SignService(connectionToken);
		serviceCollection.set(ISignService, signService);


		// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
		//
		// NOTE: Please do NOT register services here. Use `registerSingleton()`
		//       from `workbench.common.main.ts` if the service is shared between
		//       desktop and web or `workbench.web.main.ts` if the service
		//       is web only.
		//
		// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

		// Files
		const fileService = this._register(new FileService(logService));
		serviceCollection.set(IWorkbenchFileService, fileService);

		// Logger
		const loggerService = new FileLoggerService(logLevel, fileService);
		serviceCollection.set(ILoggerService, loggerService);

		await this.registerFileSystemProviders(environmentService, fileService, bufferLogger, logService, loggerService, logsPath);

		// URI Identity
		const uriIdentityService = new UriIdentityService(fileService);
		serviceCollection.set(IUriIdentityService, uriIdentityService);

		// Storage
		const storageService = await this.createStorageService({ id: 'mote' }, logService);
		serviceCollection.set(IStorageService, storageService);

		// Remote
		const remoteService = new RemoteService(productService);
		serviceCollection.set(IRemoteService, remoteService);

		// User
		const userService = new UserService(storageService, remoteService);
		serviceCollection.set(IUserService, userService);

		remoteService.userService = userService;

		// Configuration
		const configuraionService = await this.createConfigurationService(environmentService, fileService, logService);
		serviceCollection.set(IWorkbenchConfigurationService, configuraionService);

		// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
		//
		// NOTE: Please do NOT register services here. Use `registerSingleton()`
		//       from `workbench.common.main.ts` if the service is shared between
		//       desktop and web or `workbench.web.main.ts` if the service
		//       is web only.
		//
		// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

		// Credentials Service
		//const credentialsService = new BrowserCredentialsService(environmentService, remoteAgentService, productService);
		//serviceCollection.set(ICredentialsService, credentialsService);


		return { serviceCollection, logService };
	}

	private async registerFileSystemProviders(
		environmentService: IWorkbenchEnvironmentService,
		fileService: IWorkbenchFileService,
		bufferLogger: BufferLogger,
		logService: ILogService,
		loggerService: ILoggerService,
		logsPath: URI
	): Promise<void> {

		// IndexedDB is used for logging and user data
		let indexedDB: IndexedDB | undefined;
		const userDataStore = 'mote-userdata-store';
		const logsStore = 'mote-logs-store';
		const handlesStore = 'mote-filehandles-store';
		try {
			indexedDB = await IndexedDB.create('mote-web-db', 3, [userDataStore, logsStore, handlesStore]);

			// Close onWillShutdown
			this.onWillShutdownDisposables.add(toDisposable(() => indexedDB?.close()));
		} catch (error) {
			logService.error('Error while creating IndexedDB', error);
		}

		// Logger
		if (indexedDB) {
			const logFileSystemProvider = new IndexedDBFileSystemProvider(logsPath.scheme, indexedDB, logsStore, false);
			this.indexedDBFileSystemProviders.push(logFileSystemProvider);
			fileService.registerProvider(logsPath.scheme, logFileSystemProvider);
		} else {
			fileService.registerProvider(logsPath.scheme, new InMemoryFileSystemProvider());
		}

		bufferLogger.logger = loggerService.createLogger(environmentService.logFile, { id: rendererLogId, name: localize('rendererLog', "Window") });

		// User data
		let userDataProvider;
		if (indexedDB) {
			userDataProvider = new IndexedDBFileSystemProvider(Schemas.moteUserData, indexedDB, userDataStore, true);
			this.indexedDBFileSystemProviders.push(userDataProvider);
			//this.registerDeveloperActions(<IndexedDBFileSystemProvider>userDataProvider);
		} else {
			logService.info('Using in-memory user data provider');
			userDataProvider = new InMemoryFileSystemProvider();
		}
		fileService.registerProvider(Schemas.moteUserData, userDataProvider);

		// Remote file system
		//this._register(RemoteFileSystemProviderClient.register(remoteAgentService, fileService, logService));

		// Local file access (if supported by browser)
		if (WebFileSystemAccess.supported(window)) {
			fileService.registerProvider(Schemas.file, new HTMLFileSystemProvider(indexedDB, handlesStore, logService));
		}

		// In-memory
		fileService.registerProvider(Schemas.tmp, new InMemoryFileSystemProvider());
	}

	private async createStorageService(payload: any, logService: ILogService) {
		const storageService = new BrowserStorageService(payload, { currentProfile: '' } as any, logService);

		try {
			await storageService.initialize();
		} catch (error) {
			onUnexpectedError(error);
			logService.error(error);

			return storageService;
		}

		return storageService;
	}

	private async createConfigurationService(environmentService: IWorkbenchEnvironmentService, fileService: FileService, logService: ILogService): Promise<WorkbenchConfigurationService> {
		const configurationCache = new ConfigurationCache([Schemas.file, Schemas.moteUserData, Schemas.tmp] /* Cache all non native resources */, environmentService, fileService);

		const configuraionService = new WorkbenchConfigurationService(
			{ remoteAuthority: this.configuration.remoteAuthority, configurationCache },
			environmentService,
			logService,
			new NullPolicyService()
		);
		return Promise.resolve(configuraionService);
	}

	private resolveWorkspaceInitializationPayload(): any {
		let workspace: IWorkspace | undefined = undefined;
		if (this.configuration.workspaceProvider) {
			workspace = this.configuration.workspaceProvider.workspace;
		}

		// Multi-root workspace
		if (workspace && isWorkspaceToOpen(workspace)) {
			return getWorkspaceIdentifier(workspace.workspaceUri);
		}

		// Single-folder workspace
		if (workspace && isFolderToOpen(workspace)) {
			return getSingleFolderWorkspaceIdentifier(workspace.workspaceUri);
		}

		return { id: 'empty-window' };
	}
}
