/* eslint-disable code-no-unexternalized-strings */
import { INativeWindowConfiguration } from "mote/platform/window/common/window";
import { domContentLoaded } from "mote/base/browser/dom";
import { Disposable } from "mote/base/common/lifecycle";
import { ServiceCollection } from "mote/platform/instantiation/common/serviceCollection";
import { Workbench } from "mote/workbench/browser/workbench";
import { INativeWorkbenchEnvironmentService, NativeWorkbenchEnvironmentService } from "mote/workbench/services/environment/electron-sandbox/environmentService";
import { IProductService } from "mote/platform/product/common/productService";
import product from "mote/platform/product/common/product";
import { ILoggerService, ILogService, LogLevel } from "mote/platform/log/common/log";
import { isCI } from "mote/base/common/platform";
import { safeStringify } from "mote/base/common/objects";
import { IMainProcessService } from "mote/platform/ipc/electron-sandbox/services";
import { ElectronIPCMainProcessService } from "mote/platform/ipc/electron-sandbox/mainProcessService";
import { NativeLogService } from "mote/workbench/services/log/electron-sandbox/logService";
import { BrowserStorageService } from 'mote/workbench/services/storage/browser/storageService';
import { onUnexpectedError } from "mote/base/common/errors";
import { IStorageService } from "mote/platform/storage/common/storage";
import { NativeWindow } from "./window";
import { RemoteService } from 'mote/workbench/services/remote/browser/remoteService';
import { IRemoteService } from 'mote/platform/remote/common/remote';
import { UserService } from 'mote/workbench/services/user/common/userService';
import { IUserService } from 'mote/workbench/services/user/common/user';
import { LoggerChannelClient } from 'mote/platform/log/common/logIpc';
import { WorkbenchConfigurationService } from 'mote/workbench/services/configuration/browser/workbenchConfigurationService';
import { IWorkbenchConfigurationService } from 'mote/workbench/services/configuration/common/workbenchConfiguration';
import { INativeKeyboardLayoutService, NativeKeyboardLayoutService } from 'mote/workbench/services/keybinding/electron-sandbox/nativeKeyboardLayoutService';

export class DesktopMain extends Disposable {
	constructor(
		private readonly configuration: INativeWindowConfiguration
	) {
		super();
		this.init();
	}

	private init(): void {

	}

	async open(): Promise<void> {
		console.log('Open desktop');

		// Init services and wait for DOM to be ready in parallel
		const [services] = await Promise.all([this.initServices(), domContentLoaded()]);

		// Create Workbench
		const workbench = new Workbench(document.body, undefined, services.serviceCollection, services.logService);

		// Startup
		const instantiationService = workbench.startup();

		// Window
		this._register(instantiationService.createInstance(NativeWindow));
	}

	private async initServices() {
		const serviceCollection = new ServiceCollection();

		// Main Process
		const mainProcessService = this._register(new ElectronIPCMainProcessService(this.configuration.windowId));
		serviceCollection.set(IMainProcessService, mainProcessService);

		// Product
		const productService: IProductService = { _serviceBrand: undefined, ...product };
		serviceCollection.set(IProductService, productService);

		// Environment
		const environmentService = new NativeWorkbenchEnvironmentService(this.configuration, productService);
		serviceCollection.set(INativeWorkbenchEnvironmentService, environmentService);

		// Logger
		const loggerService = new LoggerChannelClient(this.configuration.windowId, this.configuration.logLevel, this.configuration.loggers, mainProcessService.getChannel('logger'));
		serviceCollection.set(ILoggerService, loggerService);

		// Log
		const logService = this._register(new NativeLogService(LogLevel.Debug, loggerService, environmentService));
		serviceCollection.set(ILogService, logService);
		logService.setLevel(LogLevel.Debug);
		if (isCI) {
			logService.info('workbench#open()'); // marking workbench open helps to diagnose flaky integration/smoke tests
		}
		if (logService.getLevel() === LogLevel.Trace) {
			logService.trace('workbench#open(): with configuration', safeStringify(this.configuration));
		}

		const [_, storageService] = await Promise.all([
			this.createWorkspaceService().then((configurationService) => {
				// Configuration
				serviceCollection.set(IWorkbenchConfigurationService, configurationService);
				return configurationService;
			}),
			this.createStorageService(logService).then((storageService) => {
				// Storage
				serviceCollection.set(IStorageService, storageService);
				return storageService;
			}),
			this.createKeyboardLayoutService(mainProcessService).then(service => {

				// KeyboardLayout
				serviceCollection.set(INativeKeyboardLayoutService, service);

				return service;
			})
		]);

		// Remote
		const remoteService = new RemoteService(productService);
		serviceCollection.set(IRemoteService, remoteService);

		// User
		const userService = new UserService(storageService, remoteService);
		serviceCollection.set(IUserService, userService);

		remoteService.userService = userService;

		return { serviceCollection, logService };
	}

	private async createStorageService(logService: ILogService) {
		const storageService = new BrowserStorageService({ id: 'mote' } as any, { currentProfile: '' } as any, logService);

		try {
			await storageService.initialize();
		} catch (error) {
			onUnexpectedError(error);
			logService.error(error);

			return storageService;
		}

		return storageService;
	}

	private async createWorkspaceService() {
		return Promise.resolve(new WorkbenchConfigurationService());
	}

	private async createKeyboardLayoutService(mainProcessService: IMainProcessService): Promise<NativeKeyboardLayoutService> {
		const keyboardLayoutService = new NativeKeyboardLayoutService(mainProcessService);

		try {
			await keyboardLayoutService.initialize();

			return keyboardLayoutService;
		} catch (error) {
			onUnexpectedError(error);

			return keyboardLayoutService;
		}
	}
}


export function main(configuration: INativeWindowConfiguration): Promise<void> {
	const workbench = new DesktopMain(configuration);

	return workbench.open();
}
