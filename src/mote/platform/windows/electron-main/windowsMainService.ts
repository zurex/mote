import { BrowserWindow, nativeTheme } from 'electron';
import { hostname, release } from 'os';
import { INativeWindowConfiguration, IOpenEmptyWindowOptions } from 'mote/platform/window/common/window';
import { IAppWindow } from 'mote/platform/window/electron-main/window';
import { distinct, firstOrDefault } from 'mote/base/common/arrays';
import { Disposable } from 'mote/base/common/lifecycle';
import { IProcessEnvironment } from 'mote/base/common/platform';
import { NativeParsedArgs } from 'mote/platform/environment/common/argv';
import { IEnvironmentMainService } from 'mote/platform/environment/electron-main/environmentMainService';
import { IInstantiationService } from 'mote/platform/instantiation/common/instantiation';
import { ILogService } from 'mote/platform/log/common/log';
import product from 'mote/platform/product/common/product';
import { AppWindow } from 'mote/platform/windows/electron-main/appWindow';
import { IOpenConfiguration, IOpenEmptyConfiguration, IWindowsCountChangedEvent, IWindowsMainService } from 'mote/platform/windows/electron-main/windows';
import { ILoggerMainService } from 'mote/platform/log/electron-main/loggerService';
import { CancellationToken } from 'mote/base/common/cancellation';
import { getMarks, mark } from 'mote/base/common/performance';
import { ILifecycleMainService } from 'mote/platform/lifecycle/electron-main/lifecycleMainService';
import { Emitter } from 'mote/base/common/event';
import { once } from 'mote/base/common/functional';
import { assertIsDefined } from 'mote/base/common/types';

interface IOpenBrowserWindowOptions {
	readonly userEnv?: IProcessEnvironment;
	readonly cli?: NativeParsedArgs;
}

export class WindowsMainService extends Disposable implements IWindowsMainService {

	private static readonly WINDOWS: IAppWindow[] = [];

	private readonly _onDidOpenWindow = this._register(new Emitter<IAppWindow>());
	readonly onDidOpenWindow = this._onDidOpenWindow.event;

	private readonly _onDidSignalReadyWindow = this._register(new Emitter<IAppWindow>());
	readonly onDidSignalReadyWindow = this._onDidSignalReadyWindow.event;

	private readonly _onDidDestroyWindow = this._register(new Emitter<IAppWindow>());
	readonly onDidDestroyWindow = this._onDidDestroyWindow.event;

	private readonly _onDidChangeWindowsCount = this._register(new Emitter<IWindowsCountChangedEvent>());
	readonly onDidChangeWindowsCount = this._onDidChangeWindowsCount.event;

	private readonly _onDidTriggerSystemContextMenu = this._register(new Emitter<{ window: IAppWindow; x: number; y: number }>());
	readonly onDidTriggerSystemContextMenu = this._onDidTriggerSystemContextMenu.event;

	constructor(
		@ILogService private readonly logService: ILogService,
		@ILoggerMainService private readonly loggerService: ILoggerMainService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IEnvironmentMainService private readonly environmentMainService: IEnvironmentMainService,
		@ILifecycleMainService private readonly lifecycleMainService: ILifecycleMainService,
	) {
		super();

		this.registerListeners();
	}

	private registerListeners(): void {

	}

	openEmptyWindow(openConfig: IOpenEmptyConfiguration, options?: IOpenEmptyWindowOptions): Promise<IAppWindow[]> {
		const cli = this.environmentMainService.args;
		const remoteAuthority = options?.remoteAuthority || undefined;
		const forceEmpty = true;
		const forceReuseWindow = options?.forceReuseWindow;
		const forceNewWindow = !forceReuseWindow;

		return this.open({ ...openConfig, cli, forceEmpty, forceNewWindow, forceReuseWindow, remoteAuthority });
	}

	async open(openConfig: IOpenConfiguration): Promise<IAppWindow[]> {

		const { windows: usedWindows } = this.doOpen(openConfig);

		// Make sure to pass focus to the most relevant of the windows if we open multiple
		if (usedWindows.length > 1) {

		}
		return usedWindows;
	}

	private doOpen(
		openConfig: IOpenConfiguration
	) {

		// Keep track of used windows and remember
		// if files have been opened in one of them
		const usedWindows: IAppWindow[] = [];
		let filesOpenedInWindow: IAppWindow | undefined = undefined;
		function addUsedWindow(window: IAppWindow, openedFiles?: boolean): void {
			usedWindows.push(window);

			if (openedFiles) {
				filesOpenedInWindow = window;
				//filesToOpen = undefined; // reset `filesToOpen` since files have been opened
			}
		}

		if (filesOpenedInWindow) {

		}

		addUsedWindow(this.openInBrowserWindow({}));

		return { windows: distinct(usedWindows) };
	}

	private openInBrowserWindow(options: IOpenBrowserWindowOptions): IAppWindow {
		this.logService.debug('this.environmentMainService.userHome', this.environmentMainService.tmpDir.fsPath);

		let window: IAppWindow | undefined;

		// Build up the window configuration from provided options, config and environment
		const configuration: INativeWindowConfiguration = {
			// Inherit CLI arguments from environment and/or
			// the specific properties from this launch if provided
			...this.environmentMainService.args,
			...options.cli,
			windowId: -1,

			homeDir: this.environmentMainService.userHome.fsPath,
			tmpDir: this.environmentMainService.tmpDir.fsPath,
			userDataDir: this.environmentMainService.userDataPath,

			mainPid: process.pid,
			appRoot: this.environmentMainService.appRoot,
			//perfMarks: [],
			userEnv: { ...options.userEnv },

			logLevel: this.logService.getLevel(),
			loggers: this.loggerService.getRegisteredLoggers(),

			product,
			perfMarks: getMarks(),
			os: { release: release(), hostname: hostname() },
			colorScheme: {
				dark: nativeTheme.shouldUseDarkColors,
				highContrast: nativeTheme.shouldUseInvertedColorScheme || nativeTheme.shouldUseHighContrastColors
			}
		};

		if (!window) {
			// Create the window
			mark('mote/willCreateCodeWindow');
			const createdWindow = window = this.instantiationService.createInstance(AppWindow);
			mark('mote/didCreateCodeWindow');

			// Add to our list of windows
			WindowsMainService.WINDOWS.push(createdWindow);

			// Indicate new window via event
			this._onDidOpenWindow.fire(createdWindow);

			// Indicate number change via event
			this._onDidChangeWindowsCount.fire({ oldCount: this.getWindowCount() - 1, newCount: this.getWindowCount() });

			// Window Events
			once(createdWindow.onDidSignalReady)(() => this._onDidSignalReadyWindow.fire(createdWindow));
			once(createdWindow.onDidClose)(() => this.onWindowClosed(createdWindow));
			once(createdWindow.onDidDestroy)(() => this._onDidDestroyWindow.fire(createdWindow));

			const webContents = assertIsDefined(createdWindow.win?.webContents);
			webContents.removeAllListeners('devtools-reload-page'); // remove built in listener so we can handle this on our own
			webContents.on('devtools-reload-page', () => this.lifecycleMainService.reload(createdWindow));

			// Lifecycle
			this.lifecycleMainService.registerWindow(createdWindow);
		}
		// Existing window
		else {
			// Some configuration things get inherited if the window is being reused and we are
			// in extension development host mode. These options are all development related.
			const currentWindowConfig = window.config;
			configuration.loggers = currentWindowConfig?.loggers ?? configuration.loggers;
		}

		this.doOpenInBrowserWindow(window, configuration, options);

		return window;
	}

	private doOpenInBrowserWindow(window: IAppWindow, configuration: INativeWindowConfiguration, options: IOpenBrowserWindowOptions) {
		// Load it
		window.load(configuration);
	}

	private onWindowClosed(window: IAppWindow): void {

		// Remove from our list so that Electron can clean it up
		const index = WindowsMainService.WINDOWS.indexOf(window);
		WindowsMainService.WINDOWS.splice(index, 1);

		// Emit
		this._onDidChangeWindowsCount.fire({ oldCount: this.getWindowCount() + 1, newCount: this.getWindowCount() });
	}

	getFocusedWindow(): IAppWindow | undefined {
		const window = BrowserWindow.getFocusedWindow();
		if (window) {
			return this.getWindowById(window.id);
		}

		return undefined;
	}

	getLastActiveWindow(): IAppWindow | undefined {
		return this.doGetLastActiveWindow(this.getWindows());
	}

	private doGetLastActiveWindow(windows: IAppWindow[]): IAppWindow | undefined {
		const lastFocusedDate = Math.max.apply(Math, windows.map(window => window.lastFocusTime));

		return windows.find(window => window.lastFocusTime === lastFocusedDate);
	}

	sendToFocused(channel: string, ...args: any[]): void {
		const focusedWindow = this.getFocusedWindow() || this.getLastActiveWindow();

		focusedWindow?.sendWhenReady(channel, CancellationToken.None, ...args);
	}

	getWindows(): IAppWindow[] {
		return WindowsMainService.WINDOWS;
	}

	getWindowCount(): number {
		return this.getWindows().length;
	}

	getWindowById(windowId: number): IAppWindow | undefined {
		const windows = this.getWindows().filter(window => window.id === windowId);

		return firstOrDefault(windows);
	}
}
