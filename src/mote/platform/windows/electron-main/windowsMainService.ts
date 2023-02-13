import { BrowserWindow, nativeTheme } from 'electron';
import { hostname, release } from 'os';
import { INativeWindowConfiguration, IOpenEmptyWindowOptions, IPath, IWindowSettings } from 'mote/platform/window/common/window';
import { IAppWindow, UnloadReason } from 'mote/platform/window/electron-main/window';
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
import { getMarks } from 'mote/base/common/performance';
import { ILifecycleMainService } from 'mote/platform/lifecycle/electron-main/lifecycleMainService';
import { Emitter } from 'mote/base/common/event';
import { once } from 'mote/base/common/functional';
import { assertIsDefined } from 'mote/base/common/types';
import { WindowsStateHandler } from 'mote/platform/windows/electron-main/windowsStateHandler';
import { IStateMainService } from 'mote/platform/state/electron-main/state';
import { IConfigurationService } from 'mote/platform/configuration/common/configuration';
import { PerformanceMark, PerformanceMarkPoint } from 'mote/base/common/performanceMark';
import { IEditorOptions } from 'mote/platform/editor/common/editor';
import { ISinglePageWorkspaceIdentifier, IWorkspaceIdentifier } from 'mote/platform/workspace/common/workspace';

interface IOpenBrowserWindowOptions {
	readonly userEnv?: IProcessEnvironment;
	readonly cli?: NativeParsedArgs;

	readonly forceNewWindow?: boolean;
	readonly forceNewTabbedWindow?: boolean;
	readonly windowToUse?: IAppWindow;

}

interface IPathToOpen<T = IEditorOptions> extends IPath<T> {

}

interface IWorkspacePathToOpen extends IPathToOpen {
	readonly workspace: IWorkspaceIdentifier;
}

interface ISinglePageWorkspacePathToOpen extends IPathToOpen {
	readonly workspace: ISinglePageWorkspaceIdentifier;
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

	private readonly windowsStateHandler = this._register(new WindowsStateHandler(this, this.stateMainService, this.lifecycleMainService, this.logService, this.configurationService));

	constructor(
		@ILogService private readonly logService: ILogService,
		@IStateMainService private readonly stateMainService: IStateMainService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
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
		this.logService.trace('windowsManager#open');

		const { windows: usedWindows } = await this.doOpen(openConfig, null, []);

		// Make sure to pass focus to the most relevant of the windows if we open multiple
		if (usedWindows.length > 1) {

		}
		return usedWindows;
	}

	private async doOpen(
		openConfig: IOpenConfiguration,
		workspaceToOpen: IWorkspacePathToOpen | null,
		pagesToOpen: ISinglePageWorkspacePathToOpen[],
	) {

		// Keep track of used windows and remember
		// if files have been opened in one of them
		const usedWindows: IAppWindow[] = [];
		let pagesOpenedInWindow: IAppWindow | undefined = undefined;
		function addUsedWindow(window: IAppWindow, openedPages?: boolean): void {
			usedWindows.push(window);

			if (openedPages) {
				pagesOpenedInWindow = window;
				//pagesToOpen = undefined; // reset `filesToOpen` since files have been opened
			}
		}

		if (pagesOpenedInWindow) {

		}

		if (pagesToOpen) {

		}

		addUsedWindow(await this.openInBrowserWindow({
			userEnv: openConfig.userEnv,
			cli: openConfig.cli,
		}));

		return { windows: distinct(usedWindows) };
	}

	private async openInBrowserWindow(options: IOpenBrowserWindowOptions): Promise<IAppWindow> {
		const windowConfig = this.configurationService.getValue<IWindowSettings | undefined>('window');

		const lastActiveWindow = this.getLastActiveWindow();

		let window: IAppWindow | undefined;
		if (!options.forceNewWindow && !options.forceNewTabbedWindow) {
			window = options.windowToUse || lastActiveWindow;
			if (window) {
				window.focus();
			}
		}

		// Build up the window configuration from provided options, config and environment
		const configuration: INativeWindowConfiguration = {
			// Inherit CLI arguments from environment and/or
			// the specific properties from this launch if provided
			...this.environmentMainService.args,
			...options.cli,

			mainPid: process.pid,

			windowId: -1, // Will be filled in by the window once loaded later

			homeDir: this.environmentMainService.userHome.fsPath,
			tmpDir: this.environmentMainService.tmpDir.fsPath,
			userDataDir: this.environmentMainService.userDataPath,


			appRoot: this.environmentMainService.appRoot,
			userEnv: { ...options.userEnv },

			logLevel: this.logService.getLevel(),
			loggers: this.loggerService.getRegisteredLoggers(),

			product,
			perfMarks: getMarks(),
			os: { release: release(), hostname: hostname() },
			zoomLevel: typeof windowConfig?.zoomLevel === 'number' ? windowConfig.zoomLevel : undefined,

			colorScheme: {
				dark: nativeTheme.shouldUseDarkColors,
				highContrast: nativeTheme.shouldUseInvertedColorScheme || nativeTheme.shouldUseHighContrastColors
			}
		};

		if (!window) {
			const state = this.windowsStateHandler.getNewWindowState(configuration);

			// Create the window
			PerformanceMark.willMark(PerformanceMarkPoint.CreateWindow);
			const createdWindow = window = this.instantiationService.createInstance(AppWindow, {
				state,
			});
			PerformanceMark.didMark(PerformanceMarkPoint.CreateWindow);

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

		// Update window identifier and session now
		// that we have the window object in hand.
		configuration.windowId = window.id;

		// If the window was already loaded, make sure to unload it
		// first and only load the new configuration if that was
		// not vetoed
		if (window.isReady) {
			this.lifecycleMainService.unload(window, UnloadReason.LOAD).then(async veto => {
				if (!veto) {
					await this.doOpenInBrowserWindow(window!, configuration, options);
				}
			});
		} else {
			await this.doOpenInBrowserWindow(window, configuration, options);
		}

		return window;
	}

	private async doOpenInBrowserWindow(window: IAppWindow, configuration: INativeWindowConfiguration, options: IOpenBrowserWindowOptions) {
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
