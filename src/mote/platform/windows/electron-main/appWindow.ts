/* eslint-disable code-no-unexternalized-strings */
import { BrowserWindow, BrowserWindowConstructorOptions } from "electron";
import { FileAccess } from "mote/base/common/network";
import { IProtocolMainService } from "mote/platform/protocol/electron-main/protocol";
import { IThemeMainService } from "mote/platform/theme/electron-main/themeMainService";
import { INativeWindowConfiguration } from "mote/platform/window/common/window";
import { IAppWindow, ILoadEvent } from "mote/platform/window/electron-main/window";
import { Disposable } from "mote/base/common/lifecycle";
import { getMarks, mark } from "mote/base/common/performance";
import { NativeParsedArgs } from 'mote/platform/environment/common/argv';
import { IEnvironmentMainService } from "mote/platform/environment/electron-main/environmentMainService";
import { isLaunchedFromCli } from "mote/platform/environment/node/argvHelper";
import { ILogService } from "mote/platform/log/common/log";
import { CancellationToken } from 'mote/base/common/cancellation';
import { toErrorMessage } from 'mote/base/common/errorMessage';
import { Emitter } from 'mote/base/common/event';
import { ILoggerMainService } from 'mote/platform/log/electron-main/loggerService';

interface ILoadOptions {
	isReload?: boolean;
	disableExtensions?: boolean;
}

const enum ReadyState {

	/**
	 * This window has not loaded anything yet
	 * and this is the initial state of every
	 * window.
	 */
	NONE,

	/**
	 * This window is navigating, either for the
	 * first time or subsequent times.
	 */
	NAVIGATING,

	/**
	 * This window has finished loading and is ready
	 * to forward IPC requests to the web contents.
	 */
	READY
}

export class AppWindow extends Disposable implements IAppWindow {

	//#region events

	private readonly _onWillLoad = this._register(new Emitter<ILoadEvent>());
	readonly onWillLoad = this._onWillLoad.event;

	//#endregion

	//#region Properties

	private _id: number;
	get id(): number { return this._id; }

	private _win: BrowserWindow;
	get win(): BrowserWindow | null { return this._win; }

	private _lastFocusTime = -1;
	get lastFocusTime(): number { return this._lastFocusTime; }

	get backupPath(): string | undefined { return undefined; }

	get openedWorkspace(): any | undefined { return undefined; }

	get remoteAuthority(): string | undefined { return undefined; }

	private _config: INativeWindowConfiguration | undefined;
	get config(): INativeWindowConfiguration | undefined { return this._config; }

	private hiddenTitleBarStyle: boolean | undefined;
	get hasHiddenTitleBarStyle(): boolean { return !!this.hiddenTitleBarStyle; }

	get isExtensionDevelopmentHost(): boolean { return false; }

	get isExtensionTestHost(): boolean { return false; }

	get isExtensionDevelopmentTestFromCli(): boolean { return false; }

	//#endregion

	private readonly whenReadyCallbacks: { (window: IAppWindow): void }[] = [];

	private readonly configObjectUrl = this._register(this.protocolMainService.createIPCObjectUrl<INativeWindowConfiguration>());
	private pendingLoadConfig: INativeWindowConfiguration | undefined;
	//private wasLoaded = false;

	constructor(
		@ILogService private readonly logService: ILogService,
		@ILoggerMainService private readonly loggerMainService: ILoggerMainService,
		@IThemeMainService private readonly themeMainService: IThemeMainService,
		@IProtocolMainService private readonly protocolMainService: IProtocolMainService,
		@IEnvironmentMainService environmentMainService: IEnvironmentMainService,
	) {
		super();

		//#region create browser window
		{
			const options: BrowserWindowConstructorOptions & { experimentalDarkMode: boolean } = {
				webPreferences: {
					preload: FileAccess.asFileUri('mote/base/parts/sandbox/electron-browser/preload.js').fsPath,
					additionalArguments: [`--mote-window-config=${this.configObjectUrl.resource.toString()}`],
					enableWebSQL: false,
					spellcheck: false,
					//nativeWindowOpen: true,
					enableBlinkFeatures: 'HighlightAPI',

					nodeIntegration: true,
					contextIsolation: false

				},
				experimentalDarkMode: true
			};

			this._win = new BrowserWindow(options);
			this._id = this._win.id;
		}

		// Eventing
		this.registerListeners();
	}

	private readyState = ReadyState.NONE;

	ready(): Promise<IAppWindow> {
		return new Promise<IAppWindow>(resolve => {
			if (this.isReady) {
				return resolve(this);
			}

			// otherwise keep and call later when we are ready
			this.whenReadyCallbacks.push(resolve);
		});
	}

	get isReady(): boolean {
		return this.readyState === ReadyState.READY;
	}

	reload(cli?: NativeParsedArgs | undefined): void {
		// Copy our current config for reuse
		const configuration = Object.assign({}, this._config);
		configuration.loggers = this.loggerMainService.getRegisteredLoggers(this.id);
	}

	send(channel: string, ...args: any[]): void {
		if (this._win) {
			if (this._win.isDestroyed() || this._win.webContents.isDestroyed()) {
				this.logService.warn(`Sending IPC message to channel '${channel}' for window that is destroyed`);
				return;
			}

			try {
				this._win.webContents.send(channel, ...args);
			} catch (error) {
				this.logService.warn(`Error sending IPC message to channel '${channel}' of window ${this._id}: ${toErrorMessage(error)}`);
			}
		}
	}

	sendWhenReady(channel: string, token: CancellationToken, ...args: any[]): void {
		if (this.isReady) {
			this.send(channel, ...args);
		} else {
			this.ready().then(() => {
				if (!token.isCancellationRequested) {
					this.send(channel, ...args);
				}
			});
		}
	}
	close(): void {
		this._win?.close();
	}

	private registerListeners() {
		// Remember that we loaded
		this._win.webContents.on('did-finish-load', () => {

			// Associate properties from the load request if provided
			if (this.pendingLoadConfig) {
				this._config = this.pendingLoadConfig;

				this.pendingLoadConfig = undefined;
			}
		});
	}

	get isFullScreen(): boolean { return this._win.isFullScreen() || this._win.isSimpleFullScreen(); }

	private updateConfiguration(configuration: INativeWindowConfiguration, options: ILoadOptions): void {

		// If this window was loaded before from the command line
		// (as indicated by VSCODE_CLI environment), make sure to
		// preserve that user environment in subsequent loads,
		// unless the new configuration context was also a CLI
		// (for https://github.com/microsoft/vscode/issues/108571)
		// Also, preserve the environment if we're loading from an
		// extension development host that had its environment set
		// (for https://github.com/microsoft/vscode/issues/123508)
		const currentUserEnv = (this._config ?? this.pendingLoadConfig)?.userEnv;
		if (currentUserEnv) {
			const shouldPreserveLaunchCliEnvironment = isLaunchedFromCli(currentUserEnv) && !isLaunchedFromCli(configuration.userEnv);
			const shouldPreserveDebugEnvironmnet = this.isExtensionDevelopmentHost;
			if (shouldPreserveLaunchCliEnvironment || shouldPreserveDebugEnvironmnet) {
				configuration.userEnv = { ...currentUserEnv, ...configuration.userEnv }; // still allow to override certain environment as passed in
			}
		}

		// If named pipe was instantiated for the crashpad_handler process, reuse the same
		// pipe for new app instances connecting to the original app instance.
		// Ref: https://github.com/microsoft/vscode/issues/115874
		if (process.env['CHROME_CRASHPAD_PIPE_NAME']) {
			Object.assign(configuration.userEnv, {
				CHROME_CRASHPAD_PIPE_NAME: process.env['CHROME_CRASHPAD_PIPE_NAME']
			});
		}

		// Add disable-extensions to the config, but do not preserve it on currentConfig or
		// pendingLoadConfig so that it is applied only on this load
		if (options.disableExtensions !== undefined) {
			configuration['disable-extensions'] = options.disableExtensions;
		}

		// Update window related properties
		configuration.fullscreen = this.isFullScreen;
		configuration.maximized = this._win.isMaximized();
		configuration.partsSplash = this.themeMainService.getWindowSplash();

		// Update with latest perf marks
		mark('mote/willOpenNewWindow');
		configuration.perfMarks = getMarks();

		this.logService.debug("[AppWindow] configuration", configuration);
		// Update in config object URL for usage in renderer
		this.configObjectUrl.update(configuration);
	}

	load(config: INativeWindowConfiguration, options: ILoadOptions = Object.create(null)): void {

		this.logService.info(`window#load: attempt to load window (id: ${this._id})`);

		// Update configuration values based on our window context
		// and set it into the config object URL for usage.
		this.updateConfiguration(config, options);

		const url = FileAccess.asBrowserUri('mote/app/electron-sandbox/workbench/workbench.html').toString();

		// Load URL
		this._win.loadURL(url);

		this.logService.info(`window#load: load window (id: ${this._id}) done`, url);
	}
}
