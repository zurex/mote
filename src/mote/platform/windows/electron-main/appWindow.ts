import { localize } from 'mote/nls';
/* eslint-disable code-no-unexternalized-strings */
import { app, BrowserWindow, BrowserWindowConstructorOptions, Display, Rectangle, screen } from 'electron';
import { FileAccess } from "mote/base/common/network";
import { IProtocolMainService } from "mote/platform/protocol/electron-main/protocol";
import { IThemeMainService } from "mote/platform/theme/electron-main/themeMainService";
import { getTitleBarStyle, INativeWindowConfiguration, IWindowSettings, MenuBarVisibility, useWindowControlsOverlay, WindowMinimumSize } from "mote/platform/window/common/window";
import { defaultWindowUIState, IAppWindow, ILoadEvent, IWindowUIState, WindowError, WindowMode } from "mote/platform/window/electron-main/window";
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
import { IConfigurationService } from 'mote/platform/configuration/common/configuration';
import { massageMessageBoxOptions } from 'mote/platform/dialogs/common/dialogs';
import { ITelemetryService } from 'mote/platform/telemetry/common/telemetry';
import { IProductService } from 'mote/platform/product/common/productService';
import { ILifecycleMainService } from 'mote/platform/lifecycle/electron-main/lifecycleMainService';
import { IDialogMainService } from 'mote/platform/dialogs/electron-main/dialogMainService';
import { isLinux, isMacintosh, isWindows } from 'mote/base/common/platform';
import { INativeHostMainService } from 'mote/platform/native/electron-main/nativeHostMainService';
import { IStateMainService } from 'mote/platform/state/electron-main/state';
import { join } from 'mote/base/common/path';
import { Color } from 'mote/base/common/color';

export interface IWindowCreationOptions {
	readonly state: IWindowUIState;
	readonly extensionDevelopmentPath?: string[];
	readonly isExtensionTestHost?: boolean;
}

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

	private static readonly windowControlHeightStateStorageKey = 'windowControlHeight';
	private static sandboxState: boolean | undefined = undefined;

	//#region events

	private readonly _onWillLoad = this._register(new Emitter<ILoadEvent>());
	readonly onWillLoad = this._onWillLoad.event;

	private readonly _onDidSignalReady = this._register(new Emitter<void>());
	readonly onDidSignalReady = this._onDidSignalReady.event;

	private readonly _onDidTriggerSystemContextMenu = this._register(new Emitter<{ x: number; y: number }>());
	readonly onDidTriggerSystemContextMenu = this._onDidTriggerSystemContextMenu.event;

	private readonly _onDidClose = this._register(new Emitter<void>());
	readonly onDidClose = this._onDidClose.event;

	private readonly _onDidDestroy = this._register(new Emitter<void>());
	readonly onDidDestroy = this._onDidDestroy.event;

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

	private readonly windowState: IWindowUIState;
	private currentMenuBarVisibility: MenuBarVisibility | undefined;

	private readonly hasWindowControlOverlay: boolean = false;

	private readonly whenReadyCallbacks: { (window: IAppWindow): void }[] = [];

	private readonly configObjectUrl = this._register(this.protocolMainService.createIPCObjectUrl<INativeWindowConfiguration>());
	private pendingLoadConfig: INativeWindowConfiguration | undefined;
	private wasLoaded = false;

	constructor(
		config: IWindowCreationOptions,
		@ILogService private readonly logService: ILogService,
		@ILoggerMainService private readonly loggerMainService: ILoggerMainService,
		@IThemeMainService private readonly themeMainService: IThemeMainService,
		@IProtocolMainService private readonly protocolMainService: IProtocolMainService,
		@IEnvironmentMainService private readonly environmentMainService: IEnvironmentMainService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IProductService private readonly productService: IProductService,
		@ILifecycleMainService private readonly lifecycleMainService: ILifecycleMainService,
		@IDialogMainService private readonly dialogMainService: IDialogMainService,
		@IStateMainService private readonly stateMainService: IStateMainService,
		@INativeHostMainService private readonly nativeHostMainService: INativeHostMainService
	) {
		super();

		//#region create browser window
		let useSandbox = false;
		{
			// Load window state
			const [state, hasMultipleDisplays] = this.restoreWindowState(config.state);
			this.windowState = state;
			this.logService.trace('window#ctor: using window state', state);

			// In case we are maximized or fullscreen, only show later
			// after the call to maximize/fullscreen (see below)
			const isFullscreenOrMaximized = (this.windowState.mode === WindowMode.Maximized || this.windowState.mode === WindowMode.Fullscreen);

			if (typeof AppWindow.sandboxState === 'undefined') {
				// we should only check this once so that we do not end up
				// with some windows in sandbox mode and some not!
				AppWindow.sandboxState = this.stateMainService.getItem<boolean>('window.experimental.useSandbox', false);
			}

			const windowSettings = this.configurationService.getValue<IWindowSettings | undefined>('window');

			if (typeof windowSettings?.experimental?.useSandbox === 'boolean') {
				useSandbox = windowSettings.experimental.useSandbox;
			} else if (this.productService.quality === 'stable' && AppWindow.sandboxState) {
				useSandbox = true;
			} else {
				useSandbox = typeof this.productService.quality === 'string' && this.productService.quality !== 'stable';
			}

			const options: BrowserWindowConstructorOptions & { experimentalDarkMode: boolean } = {
				width: this.windowState.width,
				height: this.windowState.height,
				x: this.windowState.x,
				y: this.windowState.y,
				backgroundColor: this.themeMainService.getBackgroundColor(),
				minWidth: WindowMinimumSize.WIDTH,
				minHeight: WindowMinimumSize.HEIGHT,
				show: !isFullscreenOrMaximized, // reduce flicker by showing later
				title: this.productService.nameLong,
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

			// Apply icon to window
			// Linux: always
			// Windows: only when running out of sources, otherwise an icon is set by us on the executable
			if (isLinux) {
				options.icon = join(this.environmentMainService.appRoot, 'resources/linux/code.png');
			} else if (isWindows && !this.environmentMainService.isBuilt) {
				options.icon = join(this.environmentMainService.appRoot, 'resources/win32/code_150x150.png');
			}

			if (isMacintosh && !this.useNativeFullScreen()) {
				options.fullscreenable = false; // enables simple fullscreen mode
			}

			if (isMacintosh) {
				options.acceptFirstMouse = true; // enabled by default

				if (windowSettings?.clickThroughInactive === false) {
					options.acceptFirstMouse = false;
				}
			}

			const useCustomTitleStyle = getTitleBarStyle(this.configurationService) === 'custom';
			if (useCustomTitleStyle) {
				options.titleBarStyle = 'hidden';
				if (!isMacintosh) {
					options.frame = false;
				}

				if (useWindowControlsOverlay(this.configurationService)) {

					// This logic will not perfectly guess the right colors
					// to use on initialization, but prefer to keep things
					// simple as it is temporary and not noticeable

					const titleBarColor = this.themeMainService.getWindowSplash()?.colorInfo.titleBarBackground ?? this.themeMainService.getBackgroundColor();
					const symbolColor = Color.fromHex(titleBarColor).isDarker() ? '#FFFFFF' : '#000000';

					options.titleBarOverlay = {
						height: 29, // 29 is the smallest size of the title bar on windows accounting for the border on windows 11
						color: titleBarColor,
						symbolColor
					};

					this.hasWindowControlOverlay = true;
				}
			}

			// Create the browser window
			mark('mote/willCreateMoteBrowserWindow');
			this._win = new BrowserWindow(options);
			mark('mote/didCreateMoteBrowserWindow');

			this._id = this._win.id;
		}

		// Eventing
		this.registerListeners(useSandbox);
	}

	focus(options?: { force: boolean }): void {
		// macOS: Electron > 7.x changed its behaviour to not
		// bring the application to the foreground when a window
		// is focused programmatically. Only via `app.focus` and
		// the option `steal: true` can you get the previous
		// behaviour back. The only reason to use this option is
		// when a window is getting focused while the application
		// is not in the foreground.
		if (isMacintosh && options?.force) {
			app.focus({ steal: true });
		}

		if (!this._win) {
			return;
		}

		if (this._win.isMinimized()) {
			this._win.restore();
		}

		this._win.focus();
	}

	private readyState = ReadyState.NONE;

	setReady(): void {
		this.logService.trace(`window#load: window reported ready (id: ${this._id})`);

		this.readyState = ReadyState.READY;

		// inform all waiting promises that we are ready now
		while (this.whenReadyCallbacks.length) {
			this.whenReadyCallbacks.pop()!(this);
		}

		// Events
		this._onDidSignalReady.fire();
	}

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

	get whenClosedOrLoaded(): Promise<void> {
		return new Promise<void>(resolve => {

			function handle() {
				closeListener.dispose();
				loadListener.dispose();

				resolve();
			}

			const closeListener = this.onDidClose(() => handle());
			const loadListener = this.onWillLoad(() => handle());
		});
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

	toggleFullScreen(): void {
		this.setFullScreen(!this.isFullScreen);
	}

	private setFullScreen(fullscreen: boolean): void {

	}

	private useNativeFullScreen(): boolean {
		const windowConfig = this.configurationService.getValue<IWindowSettings | undefined>('window');
		if (!windowConfig || typeof windowConfig.nativeFullScreen !== 'boolean') {
			return true; // default
		}

		if (windowConfig.nativeTabs) {
			return true; // https://github.com/electron/electron/issues/16142
		}

		return windowConfig.nativeFullScreen !== false;
	}

	isMinimized(): boolean {
		return this._win.isMinimized();
	}

	close(): void {
		this._win?.close();
	}

	private registerListeners(sandboxed: boolean) {
		// Window error conditions to handle
		this._win.on('unresponsive', () => this.onWindowError(WindowError.UNRESPONSIVE, { sandboxed }));
		this._win.webContents.on('render-process-gone', (event, details) => this.onWindowError(WindowError.PROCESS_GONE, { ...details, sandboxed }));
		this._win.webContents.on('did-fail-load', (event, exitCode, reason) => this.onWindowError(WindowError.LOAD, { reason, exitCode, sandboxed }));

		// Prevent windows/iframes from blocking the unload
		// through DOM events. We have our own logic for
		// unloading a window that should not be confused
		// with the DOM way.
		// (https://github.com/microsoft/vscode/issues/122736)
		this._win.webContents.on('will-prevent-unload', event => {
			event.preventDefault();
		});

		// Window close
		this._win.on('closed', () => {
			this._onDidClose.fire();

			this.dispose();
		});

		// Remember that we loaded
		this._win.webContents.on('did-finish-load', () => {

			// Associate properties from the load request if provided
			if (this.pendingLoadConfig) {
				this._config = this.pendingLoadConfig;

				this.pendingLoadConfig = undefined;
			}
		});

		// Window Focus
		this._win.on('focus', () => {
			this._lastFocusTime = Date.now();
		});
	}

	private async onWindowError(error: WindowError.UNRESPONSIVE, details: { sandboxed: boolean }): Promise<void>;
	private async onWindowError(error: WindowError.PROCESS_GONE, details: { reason: string; exitCode: number; sandboxed: boolean }): Promise<void>;
	private async onWindowError(error: WindowError.LOAD, details: { reason: string; exitCode: number; sandboxed: boolean }): Promise<void>;
	private async onWindowError(type: WindowError, details: { reason?: string; exitCode?: number; sandboxed: boolean }): Promise<void> {

		switch (type) {
			case WindowError.PROCESS_GONE:
				this.logService.error(`MoteWindow: renderer process gone (reason: ${details?.reason || '<unknown>'}, code: ${details?.exitCode || '<unknown>'})`);
				break;
			case WindowError.UNRESPONSIVE:
				this.logService.error('MoteWindow: detected unresponsive');
				break;
			case WindowError.LOAD:
				this.logService.error(`MoteWindow: failed to load (reason: ${details?.reason || '<unknown>'}, code: ${details?.exitCode || '<unknown>'})`);
				break;
		}

		// Telemetry
		type WindowErrorClassification = {
			type: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'The type of window error to understand the nature of the error better.' };
			reason: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'The reason of the window error to understand the nature of the error better.' };
			sandboxed: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'If the window was sandboxed or not.' };
			code: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'The exit code of the window process to understand the nature of the error better' };
			owner: 'bpasero';
			comment: 'Provides insight into reasons the vscode window had an error.';
		};
		type WindowErrorEvent = {
			type: WindowError;
			reason: string | undefined;
			code: number | undefined;
			sandboxed: string;
		};
		this.telemetryService.publicLog2<WindowErrorEvent, WindowErrorClassification>('windowerror', {
			type,
			reason: details?.reason,
			code: details?.exitCode,
			sandboxed: details?.sandboxed ? '1' : '0'
		});

		// Inform User if non-recoverable
		switch (type) {
			case WindowError.UNRESPONSIVE:
			case WindowError.PROCESS_GONE:

				// If we run extension tests from CLI, we want to signal
				// back this state to the test runner by exiting with a
				// non-zero exit code.
				if (this.isExtensionDevelopmentTestFromCli) {
					this.lifecycleMainService.kill(1);
					return;
				}

				// If we run smoke tests, want to proceed with an orderly
				// shutdown as much as possible by destroying the window
				// and then calling the normal `quit` routine.
				if (this.environmentMainService.args['enable-smoke-test-driver']) {
					await this.destroyWindow(false, false);
					this.lifecycleMainService.quit(); // still allow for an orderly shutdown
					return;
				}

				// Unresponsive
				if (type === WindowError.UNRESPONSIVE) {
					if (this.isExtensionDevelopmentHost || this.isExtensionTestHost || (this._win && this._win.webContents && this._win.webContents.isDevToolsOpened())) {
						// TODO@electron Workaround for https://github.com/microsoft/vscode/issues/56994
						// In certain cases the window can report unresponsiveness because a breakpoint was hit
						// and the process is stopped executing. The most typical cases are:
						// - devtools are opened and debugging happens
						// - window is an extensions development host that is being debugged
						// - window is an extension test development host that is being debugged
						return;
					}

					// Show Dialog
					const { options, buttonIndeces } = massageMessageBoxOptions({
						type: 'warning',
						buttons: [
							localize({ key: 'reopen', comment: ['&& denotes a mnemonic'] }, "&&Reopen"),
							localize({ key: 'close', comment: ['&& denotes a mnemonic'] }, "&&Close"),
							localize({ key: 'wait', comment: ['&& denotes a mnemonic'] }, "&&Keep Waiting")
						],
						message: localize('appStalled', "The window is not responding"),
						detail: localize('appStalledDetail', "You can reopen or close the window or keep waiting."),
						checkboxLabel: this._config?.workspace ? localize('doNotRestoreEditors', "Don't restore editors") : undefined
					}, this.productService);

					const result = await this.dialogMainService.showMessageBox(options, this._win);
					const buttonIndex = buttonIndeces[result.response];

					// Handle choice
					if (buttonIndex !== 1 /* keep waiting */) {
						const reopen = buttonIndex === 0;
						await this.destroyWindow(reopen, result.checkboxChecked);
					}
				}

				// Process gone
				else if (type === WindowError.PROCESS_GONE) {

					// Windows: running as admin with AppLocker enabled is unsupported
					//          when sandbox: true.
					//          we cannot detect AppLocker use currently, but make a
					//          guess based on the reason and exit code.
					if (isWindows && details?.reason === 'launch-failed' && details.exitCode === 18 && await this.nativeHostMainService.isAdmin(undefined)) {
						await this.handleWindowsAdminCrash(details);
					}

					// Any other crash: offer to restart
					else {
						let message: string;
						if (!details) {
							message = localize('appGone', "The window terminated unexpectedly");
						} else {
							message = localize('appGoneDetails', "The window terminated unexpectedly (reason: '{0}', code: '{1}')", details.reason, details.exitCode ?? '<unknown>');
						}

						// Show Dialog
						const { options, buttonIndeces } = massageMessageBoxOptions({
							type: 'warning',
							buttons: [
								this._config?.workspace ? localize({ key: 'reopen', comment: ['&& denotes a mnemonic'] }, "&&Reopen") : localize({ key: 'newWindow', comment: ['&& denotes a mnemonic'] }, "&&New Window"),
								localize({ key: 'close', comment: ['&& denotes a mnemonic'] }, "&&Close")
							],
							message,
							detail: this._config?.workspace ?
								localize('appGoneDetailWorkspace', "We are sorry for the inconvenience. You can reopen the window to continue where you left off.") :
								localize('appGoneDetailEmptyWindow', "We are sorry for the inconvenience. You can open a new empty window to start again."),
							checkboxLabel: this._config?.workspace ? localize('doNotRestoreEditors', "Don't restore editors") : undefined
						}, this.productService);

						const result = await this.dialogMainService.showMessageBox(options, this._win);

						// Handle choice
						const reopen = buttonIndeces[result.response] === 0;
						await this.destroyWindow(reopen, result.checkboxChecked);
					}
				}
				break;
		}
	}

	private async handleWindowsAdminCrash(details: { reason?: string; exitCode?: number; sandboxed: boolean }) {

	}

	private async destroyWindow(reopen: boolean, skipRestoreEditors: boolean): Promise<void> {
		// 'close' event will not be fired on destroy(), so signal crash via explicit event
		this._onDidDestroy.fire();

		// make sure to destroy the window as its renderer process is gone
		this._win?.destroy();
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

	serializeWindowState(): IWindowUIState {
		if (!this._win) {
			return defaultWindowUIState();
		}

		// fullscreen gets special treatment
		if (this.isFullScreen) {
			let display: Display | undefined;
			try {
				display = screen.getDisplayMatching(this.getBounds());
			} catch (error) {
				// Electron has weird conditions under which it throws errors
				// e.g. https://github.com/microsoft/vscode/issues/100334 when
				// large numbers are passed in
			}

			const defaultState = defaultWindowUIState();

			const res = {
				mode: WindowMode.Fullscreen,
				display: display ? display.id : undefined,

				// Still carry over window dimensions from previous sessions
				// if we can compute it in fullscreen state.
				// does not seem possible in all cases on Linux for example
				// (https://github.com/microsoft/vscode/issues/58218) so we
				// fallback to the defaults in that case.
				width: this.windowState.width || defaultState.width,
				height: this.windowState.height || defaultState.height,
				x: this.windowState.x || 0,
				y: this.windowState.y || 0
			};

			return res;
		}

		const state: IWindowUIState = Object.create(null);
		let mode: WindowMode;

		// get window mode
		if (!isMacintosh && this._win.isMaximized()) {
			mode = WindowMode.Maximized;
		} else {
			mode = WindowMode.Normal;
		}

		// we don't want to save minimized state, only maximized or normal
		if (mode === WindowMode.Maximized) {
			state.mode = WindowMode.Maximized;
		} else {
			state.mode = WindowMode.Normal;
		}

		// only consider non-minimized window states
		if (mode === WindowMode.Normal || mode === WindowMode.Maximized) {
			let bounds: Rectangle;
			if (mode === WindowMode.Normal) {
				bounds = this.getBounds();
			} else {
				bounds = this._win.getNormalBounds(); // make sure to persist the normal bounds when maximized to be able to restore them
			}

			state.x = bounds.x;
			state.y = bounds.y;
			state.width = bounds.width;
			state.height = bounds.height;
		}

		return state;
	}

	updateWindowControls(options: { height?: number; backgroundColor?: string; foregroundColor?: string }): void {

		// Cache the height for speeds lookups on startup
		if (options.height) {
			this.stateMainService.setItem((AppWindow.windowControlHeightStateStorageKey), options.height);
		}

		// Windows: window control overlay (WCO)
		if (isWindows && this.hasWindowControlOverlay) {
			this._win.setTitleBarOverlay({
				color: options.backgroundColor?.trim() === '' ? undefined : options.backgroundColor,
				symbolColor: options.foregroundColor?.trim() === '' ? undefined : options.foregroundColor,
				height: options.height ? options.height - 1 : undefined // account for window border
			});
		}

		// macOS: traffic lights
		else if (isMacintosh && options.height !== undefined) {
			const verticalOffset = (options.height - 15) / 2; // 15px is the height of the traffic lights
			this._win.setTrafficLightPosition({ x: verticalOffset, y: verticalOffset });
		}
	}

	private restoreWindowState(state?: IWindowUIState): [IWindowUIState, boolean? /* has multiple displays */] {
		mark('mote/willRestoreAppWindowState');

		let hasMultipleDisplays = false;
		if (state) {
			try {
				const displays = screen.getAllDisplays();
				hasMultipleDisplays = displays.length > 1;

				state = this.validateWindowState(state, displays);
			} catch (err) {
				this.logService.warn(`Unexpected error validating window state: ${err}\n${err.stack}`); // somehow display API can be picky about the state to validate
			}
		}

		mark('mote/didRestoreAppWindowState');

		return [state || defaultWindowUIState(), hasMultipleDisplays];
	}

	private validateWindowState(state: IWindowUIState, displays: Display[]): IWindowUIState | undefined {
		this.logService.trace(`window#validateWindowState: validating window state on ${displays.length} display(s)`, state);

		if (
			typeof state.x !== 'number' ||
			typeof state.y !== 'number' ||
			typeof state.width !== 'number' ||
			typeof state.height !== 'number'
		) {
			this.logService.trace('window#validateWindowState: unexpected type of state values');

			return undefined;
		}

		if (state.width <= 0 || state.height <= 0) {
			this.logService.trace('window#validateWindowState: unexpected negative values');

			return undefined;
		}

		// Single Monitor: be strict about x/y positioning
		// macOS & Linux: these OS seem to be pretty good in ensuring that a window is never outside of it's bounds.
		// Windows: it is possible to have a window with a size that makes it fall out of the window. our strategy
		//          is to try as much as possible to keep the window in the monitor bounds. we are not as strict as
		//          macOS and Linux and allow the window to exceed the monitor bounds as long as the window is still
		//          some pixels (128) visible on the screen for the user to drag it back.
		if (displays.length === 1) {
			const displayWorkingArea = this.getWorkingArea(displays[0]);
			if (displayWorkingArea) {
				this.logService.trace('window#validateWindowState: 1 monitor working area', displayWorkingArea);

				function ensureStateInDisplayWorkingArea(): void {
					if (!state || typeof state.x !== 'number' || typeof state.y !== 'number' || !displayWorkingArea) {
						return;
					}

					if (state.x < displayWorkingArea.x) {
						// prevent window from falling out of the screen to the left
						state.x = displayWorkingArea.x;
					}

					if (state.y < displayWorkingArea.y) {
						// prevent window from falling out of the screen to the top
						state.y = displayWorkingArea.y;
					}
				}

				// ensure state is not outside display working area (top, left)
				ensureStateInDisplayWorkingArea();

				if (state.width > displayWorkingArea.width) {
					// prevent window from exceeding display bounds width
					state.width = displayWorkingArea.width;
				}

				if (state.height > displayWorkingArea.height) {
					// prevent window from exceeding display bounds height
					state.height = displayWorkingArea.height;
				}

				if (state.x > (displayWorkingArea.x + displayWorkingArea.width - 128)) {
					// prevent window from falling out of the screen to the right with
					// 128px margin by positioning the window to the far right edge of
					// the screen
					state.x = displayWorkingArea.x + displayWorkingArea.width - state.width;
				}

				if (state.y > (displayWorkingArea.y + displayWorkingArea.height - 128)) {
					// prevent window from falling out of the screen to the bottom with
					// 128px margin by positioning the window to the far bottom edge of
					// the screen
					state.y = displayWorkingArea.y + displayWorkingArea.height - state.height;
				}

				// again ensure state is not outside display working area
				// (it may have changed from the previous validation step)
				ensureStateInDisplayWorkingArea();
			}

			return state;
		}

		// Multi Montior (fullscreen): try to find the previously used display
		if (state.display && state.mode === WindowMode.Fullscreen) {
			const display = displays.find(d => d.id === state.display);
			if (display && typeof display.bounds?.x === 'number' && typeof display.bounds?.y === 'number') {
				this.logService.trace('window#validateWindowState: restoring fullscreen to previous display');

				const defaults = defaultWindowUIState(WindowMode.Fullscreen); // make sure we have good values when the user restores the window
				defaults.x = display.bounds.x; // carefull to use displays x/y position so that the window ends up on the correct monitor
				defaults.y = display.bounds.y;

				return defaults;
			}
		}

		// Multi Monitor (non-fullscreen): ensure window is within display bounds
		let display: Display | undefined;
		let displayWorkingArea: Rectangle | undefined;
		try {
			display = screen.getDisplayMatching({ x: state.x, y: state.y, width: state.width, height: state.height });
			displayWorkingArea = this.getWorkingArea(display);
		} catch (error) {
			// Electron has weird conditions under which it throws errors
			// e.g. https://github.com/microsoft/vscode/issues/100334 when
			// large numbers are passed in
		}

		if (
			display &&														// we have a display matching the desired bounds
			displayWorkingArea &&											// we have valid working area bounds
			state.x + state.width > displayWorkingArea.x &&					// prevent window from falling out of the screen to the left
			state.y + state.height > displayWorkingArea.y &&				// prevent window from falling out of the screen to the top
			state.x < displayWorkingArea.x + displayWorkingArea.width &&	// prevent window from falling out of the screen to the right
			state.y < displayWorkingArea.y + displayWorkingArea.height		// prevent window from falling out of the screen to the bottom
		) {
			this.logService.trace('window#validateWindowState: multi-monitor working area', displayWorkingArea);

			return state;
		}

		return undefined;
	}

	private getWorkingArea(display: Display): Rectangle | undefined {

		// Prefer the working area of the display to account for taskbars on the
		// desktop being positioned somewhere (https://github.com/microsoft/vscode/issues/50830).
		//
		// Linux X11 sessions sometimes report wrong display bounds, so we validate
		// the reported sizes are positive.
		if (display.workArea.width > 0 && display.workArea.height > 0) {
			return display.workArea;
		}

		if (display.bounds.width > 0 && display.bounds.height > 0) {
			return display.bounds;
		}

		return undefined;
	}

	getBounds(): Rectangle {
		const [x, y] = this._win.getPosition();
		const [width, height] = this._win.getSize();

		return { x, y, width, height };
	}
}
