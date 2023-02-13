/* eslint-disable code-no-unexternalized-strings */
import { app, ipcMain } from "electron";
import { ILifecycleMainService, LifecycleMainPhase, ShutdownReason } from 'mote/platform/lifecycle/electron-main/lifecycleMainService';
import { IUpdateService } from 'mote/platform/update/common/update';
import { DarwinUpdateService } from 'mote/platform/update/electron-main/updateService.darwin';
import { IWindowsMainService, OpenContext } from "mote/platform/windows/electron-main/windows";
import { WindowsMainService } from "mote/platform/windows/electron-main/windowsMainService";
import { onUnexpectedError, setUnexpectedErrorHandler } from "mote/base/common/errors";
import { Disposable } from "mote/base/common/lifecycle";
import { IEnvironmentMainService } from 'mote/platform/environment/electron-main/environmentMainService';
import { SyncDescriptor } from "mote/platform/instantiation/common/descriptors";
import { IInstantiationService, ServicesAccessor } from "mote/platform/instantiation/common/instantiation";
import { ServiceCollection } from "mote/platform/instantiation/common/serviceCollection";
import { ILogService } from "mote/platform/log/common/log";
import { Server as ElectronIPCServer } from 'mote/base/parts/ipc/electron-main/ipc.electron';
import { Client as MessagePortClient } from 'mote/base/parts/ipc/electron-main/ipc.mp';
import { IStateMainService } from 'mote/platform/state/electron-main/state';
import { IProcessEnvironment, isMacintosh } from 'mote/base/common/platform';
import { ITelemetryService, machineIdKey } from 'mote/platform/telemetry/common/telemetry';
import { getMachineId } from 'mote/base/node/id';
import { SharedProcess } from 'mote/platform/sharedProcess/electron-main/sharedProcess';
import { WindowError } from 'mote/platform/window/electron-main/window';
import { ILoggerMainService } from 'mote/platform/log/electron-main/loggerService';
import { LoggerChannel } from 'mote/platform/log/electron-main/logIpc';
import { INativeHostMainService, NativeHostMainService } from 'mote/platform/native/electron-main/nativeHostMainService';
import { ProxyChannel } from 'mote/base/parts/ipc/common/ipc';
import { DialogMainService, IDialogMainService } from 'mote/platform/dialogs/electron-main/dialogMainService';
import { IKeyboardLayoutMainService, KeyboardLayoutMainService } from 'mote/platform/keyboardLayout/electron-main/keyboardLayoutMainService';
import { IMenubarMainService, MenubarMainService } from 'mote/platform/menubar/electron-main/menubarMainService';
import { isLaunchedFromCli } from 'mote/platform/environment/node/argvHelper';
import { UpdateChannel } from 'mote/platform/update/common/updateIpc';
import { IInitialProtocolUrls } from 'mote/platform/url/electron-main/url';
import { once } from 'mote/base/common/functional';
import { RunOnceScheduler, runWhenIdle } from 'mote/base/common/async';
import { NullTelemetryService } from 'mote/platform/telemetry/common/telemetryUtils';

export class MoteApplication extends Disposable {

	private windowsMainService: IWindowsMainService | undefined;
	private nativeHostMainService: INativeHostMainService | undefined;

	constructor(
		private readonly userEnv: IProcessEnvironment,
		@ILogService private readonly logService: ILogService,
		@IStateMainService private readonly stateMainService: IStateMainService,
		@ILifecycleMainService private readonly lifecycleMainService: ILifecycleMainService,
		@IEnvironmentMainService private readonly environmentMainService: IEnvironmentMainService,
		@IInstantiationService private readonly mainInstantiationService: IInstantiationService,
	) {
		super();

		this.registerListeners();
	}

	private registerListeners(): void {
		// We handle uncaught exceptions here to prevent electron from opening a dialog to the user
		setUnexpectedErrorHandler(error => this.onUnexpectedError(error));
		process.on('uncaughtException', error => onUnexpectedError(error));
		process.on('unhandledRejection', (reason: unknown) => onUnexpectedError(reason));

		// Dispose on shutdown
		this.lifecycleMainService.onWillShutdown(() => this.dispose());

		// macOS dock activate
		app.on('activate', (event, hasVisibleWindows) => {
			this.logService.trace('app#activate');

			// Mac only event: open new window when we get activated
			if (!hasVisibleWindows) {
				this.windowsMainService?.openEmptyWindow({ context: OpenContext.DOCK });
			}
		});

		ipcMain.handle('mote:fetchShellEnv', event => {

		});
	}

	async startup(): Promise<void> {
		this.logService.debug('Starting Mote');
		this.logService.debug(`from: ${this.environmentMainService.appRoot}`);
		this.logService.debug('args:', this.environmentMainService.args);

		// Main process server (electron IPC based)
		const mainProcessElectronServer = new ElectronIPCServer();
		this.lifecycleMainService.onWillShutdown(e => {
			if (e.reason === ShutdownReason.KILL) {
				// When we go down abnormally, make sure to free up
				// any IPC we accept from other windows to reduce
				// the chance of doing work after we go down. Kill
				// is special in that it does not orderly shutdown
				// windows.
				mainProcessElectronServer.dispose();
			}
		});

		// Resolve unique machine ID
		this.logService.trace('Resolving machine identifier...');
		const machineId = await this.resolveMachineId();
		this.logService.trace(`Resolved machine identifier: ${machineId}`);

		// Shared process
		const { sharedProcess, sharedProcessReady, sharedProcessClient } = this.setupSharedProcess(machineId);

		// Services
		const appInstantiationService = await this.initServices(machineId, sharedProcess, sharedProcessReady);

		// Init Channels
		appInstantiationService.invokeFunction(accessor => this.initChannels(accessor, mainProcessElectronServer, sharedProcessClient));

		// Open Windows
		appInstantiationService.invokeFunction(
			accessor => this.openFirstWindow(accessor, undefined)
		);

		// Signal phase: after window open
		this.lifecycleMainService.phase = LifecycleMainPhase.AfterWindowOpen;

		// Post Open Windows Tasks
		appInstantiationService.invokeFunction(accessor => this.afterWindowOpen(accessor, sharedProcess));

		// Set lifecycle phase to `Eventually` after a short delay and when idle (min 2.5sec, max 5sec)
		const eventuallyPhaseScheduler = this._register(new RunOnceScheduler(() => {
			this._register(runWhenIdle(() => this.lifecycleMainService.phase = LifecycleMainPhase.Eventually, 2500));
		}, 2500));
		eventuallyPhaseScheduler.schedule();
	}

	private onUnexpectedError(error: Error): void {
		if (error) {

			// take only the message and stack property
			const friendlyError = {
				message: `[uncaught exception in main]: ${error.message}`,
				stack: error.stack
			};

			// handle on client side
			this.windowsMainService?.sendToFocused('mote:reportError', JSON.stringify(friendlyError));
		}

		this.logService.error(`[uncaught exception in main]: ${error}`);
		if (error.stack) {
			this.logService.error(error.stack);
		}
	}

	private async resolveMachineId(): Promise<string> {

		// We cache the machineId for faster lookups on startup
		// and resolve it only once initially if not cached or we need to replace the macOS iBridge device
		let machineId = this.stateMainService.getItem<string>(machineIdKey);
		if (!machineId || (isMacintosh && machineId === '6c9d2bc8f91b89624add29c0abeae7fb42bf539fa1cdb2e3e57cd668fa9bcead')) {
			machineId = await getMachineId();

			this.stateMainService.setItem(machineIdKey, machineId);
		}

		return machineId;
	}

	private setupSharedProcess(machineId: string): { sharedProcess: SharedProcess; sharedProcessReady: Promise<MessagePortClient>; sharedProcessClient: Promise<MessagePortClient> } {
		const sharedProcess = this._register(this.mainInstantiationService.createInstance(SharedProcess, machineId, this.userEnv));

		const sharedProcessClient = (async () => {
			this.logService.trace('Main->SharedProcess#connect');

			const port = await sharedProcess.connect();

			this.logService.trace('Main->SharedProcess#connect: connection established');

			return new MessagePortClient(port, 'main');
		})();

		const sharedProcessReady = (async () => {
			await sharedProcess.whenReady();

			return sharedProcessClient;
		})();

		return { sharedProcess, sharedProcessReady, sharedProcessClient };
	}

	private async initServices(machineId: string, sharedProcess: SharedProcess, sharedProcessReady: Promise<MessagePortClient>) {
		const services = new ServiceCollection();

		// Update
		switch (process.platform) {
			case 'win32':
				//services.set(IUpdateService, new SyncDescriptor(Win32UpdateService));
				break;

			case 'linux':
				/*
				if (isLinuxSnap) {
					services.set(IUpdateService, new SyncDescriptor(SnapUpdateService, [process.env['SNAP'], process.env['SNAP_REVISION']]));
				} else {
					services.set(IUpdateService, new SyncDescriptor(LinuxUpdateService));
				}
				*/
				break;

			case 'darwin':
				services.set(IUpdateService, new SyncDescriptor(DarwinUpdateService));
				break;
		}

		// Windows
		services.set(IWindowsMainService, new SyncDescriptor(WindowsMainService));

		// Dialogs
		const dialogMainService = new DialogMainService(this.logService);
		services.set(IDialogMainService, dialogMainService);

		// Keyboard Layout
		services.set(IKeyboardLayoutMainService, new SyncDescriptor(KeyboardLayoutMainService));

		// Native Host
		services.set(INativeHostMainService, new SyncDescriptor(NativeHostMainService, [sharedProcess], false /* proxied to other processes */));

		// Menubar
		services.set(IMenubarMainService, new SyncDescriptor(MenubarMainService));

		//services.set(IWorkspacesService, new SyncDescriptor(BrowserWorkspacesService, undefined, false /* proxied to other processes */));

		services.set(ITelemetryService, NullTelemetryService);

		return this.mainInstantiationService.createChild(services);
	}

	private initChannels(accessor: ServicesAccessor, mainProcessElectronServer: ElectronIPCServer, sharedProcessClient: Promise<MessagePortClient>): void {

		// Channels registered to node.js are exposed to second instances
		// launching because that is the only way the second instance
		// can talk to the first instance. Electron IPC does not work
		// across apps until `requestSingleInstance` APIs are adopted.

		// Update
		const updateChannel = new UpdateChannel(accessor.get(IUpdateService));
		mainProcessElectronServer.registerChannel('update', updateChannel);

		// Keyboard Layout
		const keyboardLayoutChannel = ProxyChannel.fromService(accessor.get(IKeyboardLayoutMainService));
		mainProcessElectronServer.registerChannel('keyboardLayout', keyboardLayoutChannel);

		// Native host (main & shared process)
		this.nativeHostMainService = accessor.get(INativeHostMainService);
		const nativeHostChannel = ProxyChannel.fromService(this.nativeHostMainService);
		mainProcessElectronServer.registerChannel('nativeHost', nativeHostChannel);
		sharedProcessClient.then(client => client.registerChannel('nativeHost', nativeHostChannel));

		// Logger
		const loggerChannel = new LoggerChannel(accessor.get(ILoggerMainService),);
		mainProcessElectronServer.registerChannel('logger', loggerChannel);
		sharedProcessClient.then(client => client.registerChannel('logger', loggerChannel));

		// Menubar
		const menubarChannel = ProxyChannel.fromService(accessor.get(IMenubarMainService));
		mainProcessElectronServer.registerChannel('menubar', menubarChannel);

	}

	private openFirstWindow(accessor: ServicesAccessor, initialProtocolUrls: IInitialProtocolUrls | undefined) {
		this.windowsMainService = accessor.get(IWindowsMainService);

		const context = isLaunchedFromCli(process.env) ? OpenContext.CLI : OpenContext.DESKTOP;
		const args = this.environmentMainService.args;

		// First check for windows from protocol links to open
		if (initialProtocolUrls) {
			// Openables can open as windows directly
			if (initialProtocolUrls.openables.length > 0) {
				return this.windowsMainService.open({
					cli: args,
					context: context
				});
			}
		}

		return this.windowsMainService.open({
			cli: args,
			context: context
		});

	}

	private async afterWindowOpen(accessor: ServicesAccessor, sharedProcess: SharedProcess): Promise<void> {
		const telemetryService = accessor.get(ITelemetryService);
		const updateService = accessor.get(IUpdateService);

		this.handleSharedProcessErrors(telemetryService, sharedProcess);

		if (updateService instanceof DarwinUpdateService) {
			this.logService.trace('initialize updateService');
			await updateService.initialize();
		}
	}

	private handleSharedProcessErrors(telemetryService: ITelemetryService, sharedProcess: SharedProcess) {
		// Observe shared process for errors
		let willShutdown = false;
		once(this.lifecycleMainService.onWillShutdown)(() => willShutdown = true);
		this._register(sharedProcess.onDidError(({ type, details }) => {

			// Logging
			let message: string;
			switch (type) {
				case WindowError.UNRESPONSIVE:
					message = 'SharedProcess: detected unresponsive window';
					break;
				case WindowError.PROCESS_GONE:
					message = `SharedProcess: renderer process gone (detail: ${details?.reason ?? '<unknown>'}, code: ${details?.exitCode ?? '<unknown>'})`;
					break;
				case WindowError.LOAD:
					message = `SharedProcess: failed to load (detail: ${details?.reason ?? '<unknown>'}, code: ${details?.exitCode ?? '<unknown>'})`;
					break;
			}
			onUnexpectedError(new Error(message));
		}));
	}
}
