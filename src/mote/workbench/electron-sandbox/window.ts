import { localize } from 'mote/nls';
import { addDisposableListener, EventHelper, EventType, scheduleAtNextAnimationFrame } from 'mote/base/browser/dom';
import { onUnexpectedError } from 'mote/base/common/errors';
import { Disposable } from 'mote/base/common/lifecycle';
import { isCI, isMacintosh } from 'mote/base/common/platform';
import { ipcRenderer } from 'mote/base/parts/sandbox/electron-sandbox/globals';
import { ICommandService } from 'mote/platform/commands/common/commands';
import { IDialogService } from 'mote/platform/dialogs/common/dialogs';
import { IKeybindingService } from 'mote/platform/keybinding/common/keybinding';
import { ILogService } from 'mote/platform/log/common/log';
import { INativeHostService } from 'mote/platform/native/electron-sandbox/native';
import { INotificationService, Severity } from 'mote/platform/notification/common/notification';
import { INativeRunActionInWindowRequest, INativeRunKeybindingInWindowRequest } from 'mote/platform/window/common/window';
import { SideBySideEditor } from 'mote/workbench/common/editor';
import { IEditorGroupsService } from 'mote/workbench/services/editor/common/editorGroupsService';
import { IEditorService } from 'mote/workbench/services/editor/common/editorService';
import { IWorkbenchLayoutService } from 'mote/workbench/services/layout/browser/layoutService';
import { ILifecycleService, LifecyclePhase, ShutdownReason } from 'mote/workbench/services/lifecycle/common/lifecycle';
import { IConfigurationService } from 'mote/platform/configuration/common/configuration';
import { ServicesAccessor } from 'mote/platform/instantiation/common/instantiation';

export class NativeWindow extends Disposable {
	constructor(
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IEditorService private readonly editorService: IEditorService,
		@IEditorGroupsService private readonly editorGroupService: IEditorGroupsService,
		@INotificationService private readonly notificationService: INotificationService,
		@ICommandService private readonly commandService: ICommandService,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
		@ILifecycleService private readonly lifecycleService: ILifecycleService,
		@INativeHostService private readonly nativeHostService: INativeHostService,
		@IDialogService private readonly dialogService: IDialogService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.registerListeners();
		this.create();
	}

	private registerListeners(): void {
		// Layout
		this._register(addDisposableListener(window, EventType.RESIZE, e => this.onWindowResize(e, true)));

		// prevent opening a real URL inside the window
		for (const event of [EventType.DRAG_OVER, EventType.DROP]) {
			window.document.body.addEventListener(event, (e: DragEvent) => {
				EventHelper.stop(e);
			});
		}

		// Support runAction event
		ipcRenderer.on('mote:runAction', async (event: unknown, request: INativeRunActionInWindowRequest) => {
			const args: unknown[] = request.args || [];

			// If we run an action from the touchbar, we fill in the currently active resource
			// as payload because the touch bar items are context aware depending on the editor
			if (request.from === 'touchbar') {
				const activeEditor = this.editorService.activeEditor;
				if (activeEditor) {
					const resource = EditorResourceAccessor.getOriginalUri(activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
					if (resource) {
						args.push(resource);
					}
				}
			} else {
				args.push({ from: request.from });
			}

			try {
				console.log('on run Action', request.id, args);
				await this.commandService.executeCommand(request.id, ...args);

				//this.telemetryService.publicLog2<WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification>('workbenchActionExecuted', { id: request.id, from: request.from });
			} catch (error) {
				this.notificationService.error(error);
			}
		});

		// Support runKeybinding event
		ipcRenderer.on('mote:runKeybinding', (event: unknown, request: INativeRunKeybindingInWindowRequest) => {
			if (document.activeElement) {
				this.keybindingService.dispatchByUserSettingsLabel(request.userSettingsLabel, document.activeElement);
			}
		});

		// Error reporting from main
		ipcRenderer.on('mote:reportError', (event: unknown, error: string) => {
			if (error) {
				onUnexpectedError(JSON.parse(error));
			}
		});
	}

	static async confirmOnShutdown(accessor: ServicesAccessor, reason: ShutdownReason): Promise<boolean> {
		const dialogService = accessor.get(IDialogService);
		const configurationService = accessor.get(IConfigurationService);

		const message = reason === ShutdownReason.QUIT ?
			(isMacintosh ? localize('quitMessageMac', "Are you sure you want to quit?") : localize('quitMessage', "Are you sure you want to exit?")) :
			localize('closeWindowMessage', "Are you sure you want to close the window?");
		const primaryButton = reason === ShutdownReason.QUIT ?
			(isMacintosh ? localize({ key: 'quitButtonLabel', comment: ['&& denotes a mnemonic'] }, "&&Quit") : localize({ key: 'exitButtonLabel', comment: ['&& denotes a mnemonic'] }, "&&Exit")) :
			localize({ key: 'closeWindowButtonLabel', comment: ['&& denotes a mnemonic'] }, "&&Close Window");

		const res = await dialogService.confirm({
			type: 'question',
			message,
			primaryButton,
			checkbox: {
				label: localize('doNotAskAgain', "Do not ask me again")
			}
		});

		// Update setting if checkbox checked
		if (res.checkboxChecked) {
			await configurationService.updateValue('window.confirmBeforeClose', 'never');
		}

		return res.confirmed;
	}

	private onWindowResize(e: UIEvent, retry: boolean): void {
		if (e.target === window) {
			if (window.document && window.document.body && window.document.body.clientWidth === 0) {
				// TODO@electron this is an electron issue on macOS when simple fullscreen is enabled
				// where for some reason the window clientWidth is reported as 0 when switching
				// between simple fullscreen and normal screen. In that case we schedule the layout
				// call at the next animation frame once, in the hope that the dimensions are
				// proper then.
				if (retry) {
					scheduleAtNextAnimationFrame(() => this.onWindowResize(e, false));
				}
				return;
			}

			this.layoutService.layout();
		}
	}

	private create(): void {
		// Notify some services about lifecycle phases
		console.log('create native window:', this.lifecycleService.phase, this.nativeHostService);
		this.lifecycleService.when(LifecyclePhase.Ready).then(() => this.nativeHostService.notifyReady());

		// Check for situations that are worth warning the user about
		this.handleWarnings();
	}

	private async handleWarnings(): Promise<void> {

		// Check for cyclic dependencies
		if (typeof require.hasDependencyCycle === 'function' && require.hasDependencyCycle()) {
			if (isCI) {
				this.logService.error('Error: There is a dependency cycle in the AMD modules that needs to be resolved!');
				this.nativeHostService.exit(37); // running on a build machine, just exit without showing a dialog
			} else {
				this.dialogService.show(Severity.Error, localize('loaderCycle', "There is a dependency cycle in the AMD modules that needs to be resolved!"));
				this.nativeHostService.openDevTools();
			}
		}
	}
}
