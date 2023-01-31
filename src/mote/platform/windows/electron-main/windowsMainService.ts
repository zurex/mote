/* eslint-disable code-no-unexternalized-strings */
import { BrowserWindow, nativeTheme } from "electron";
import { hostname, release } from 'os';
import { INativeWindowConfiguration } from "mote/platform/window/common/window";
import { IAppWindow } from "mote/platform/window/electron-main/window";
import { distinct, firstOrDefault } from "mote/base/common/arrays";
import { Disposable } from "mote/base/common/lifecycle";
import { IProcessEnvironment } from "mote/base/common/platform";
import { NativeParsedArgs } from "mote/platform/environment/common/argv";
import { IEnvironmentMainService } from "mote/platform/environment/electron-main/environmentMainService";
import { IInstantiationService } from "mote/platform/instantiation/common/instantiation";
import { ILogService } from "mote/platform/log/common/log";
import product from "mote/platform/product/common/product";
import { AppWindow } from "./appWindow";
import { IOpenConfiguration, IWindowsMainService } from "./windows";
import { ILoggerMainService } from 'mote/platform/log/electron-main/loggerService';
import { CancellationToken } from 'mote/base/common/cancellation';
import { getMarks, mark } from 'mote/base/common/performance';
import { ILifecycleMainService } from 'mote/platform/lifecycle/electron-main/lifecycleMainService';

interface IOpenBrowserWindowOptions {
	readonly userEnv?: IProcessEnvironment;
	readonly cli?: NativeParsedArgs;
}

export class WindowsMainService extends Disposable implements IWindowsMainService {

	private static readonly WINDOWS: IAppWindow[] = [];

	constructor(
		@ILogService private readonly logService: ILogService,
		@ILoggerMainService private readonly loggerService: ILoggerMainService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IEnvironmentMainService private readonly environmentMainService: IEnvironmentMainService,
		@ILifecycleMainService private readonly lifecycleMainService: ILifecycleMainService,
	) {
		super();
	}

	open(openConfig: IOpenConfiguration): IAppWindow[] {

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
		this.logService.debug("this.environmentMainService.userHome", this.environmentMainService.tmpDir.fsPath);

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

	getWindowById(windowId: number): IAppWindow | undefined {
		const windows = this.getWindows().filter(window => window.id === windowId);

		return firstOrDefault(windows);
	}
}
