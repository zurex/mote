import { Codicon } from 'mote/base/common/codicons';
import { ThemeIcon } from 'mote/base/common/themables';
import { URI } from 'mote/base/common/uri';
import { localize } from 'mote/nls';
import { Action2, IAction2Options } from 'mote/platform/actions/common/actions';
import { ServicesAccessor } from 'mote/platform/instantiation/common/instantiation';
import { IQuickInputButton, IQuickPickItem } from 'mote/platform/quickinput/common/quickInput';
import { IWindowOpenable } from 'mote/platform/window/common/window';
import { IWorkspacesService } from 'mote/platform/workspaces/common/workspaces';
export const inRecentFilesPickerContextKey = 'inRecentFilesPicker';

interface IRecentlyOpenedPick extends IQuickPickItem {
	resource: URI;
	openable: IWindowOpenable;
	remoteAuthority: string | undefined;
}

const fileCategory = { value: localize('file', "File"), original: 'File' };


abstract class BaseOpenRecentAction extends Action2 {

	private readonly removeFromRecentlyOpened: IQuickInputButton = {
		iconClass: ThemeIcon.asClassName(Codicon.removeClose),
		tooltip: localize('remove', "Remove from Recently Opened")
	};

	private readonly dirtyRecentlyOpenedFolder: IQuickInputButton = {
		iconClass: 'dirty-workspace ' + ThemeIcon.asClassName(Codicon.closeDirty),
		tooltip: localize('dirtyRecentlyOpenedFolder', "Folder With Unsaved Files"),
		alwaysVisible: true
	};

	private readonly dirtyRecentlyOpenedWorkspace: IQuickInputButton = {
		...this.dirtyRecentlyOpenedFolder,
		tooltip: localize('dirtyRecentlyOpenedWorkspace', "Workspace With Unsaved Files"),
	};

	constructor(desc: Readonly<IAction2Options>) {
		super(desc);
	}

	protected abstract isQuickNavigate(): boolean;

	override async run(accessor: ServicesAccessor): Promise<void> {
		const workspacesService = accessor.get(IWorkspacesService);
		const quickInputService = accessor.get(IQuickInputService);
		const contextService = accessor.get(IWorkspaceContextService);
		const labelService = accessor.get(ILabelService);
		const keybindingService = accessor.get(IKeybindingService);
		const modelService = accessor.get(IModelService);
		const languageService = accessor.get(ILanguageService);
		const hostService = accessor.get(IHostService);
		const dialogService = accessor.get(IDialogService);

		const recentlyOpened = await workspacesService.getRecentlyOpened();
		const dirtyWorkspacesAndFolders = await workspacesService.getDirtyWorkspaces();

		let hasWorkspaces = false;

		// Identify all folders and workspaces with unsaved files
		const dirtyFolders = new ResourceMap<boolean>();
		const dirtyWorkspaces = new ResourceMap<IWorkspaceIdentifier>();
		for (const dirtyWorkspace of dirtyWorkspacesAndFolders) {
			if (isFolderBackupInfo(dirtyWorkspace)) {
				dirtyFolders.set(dirtyWorkspace.folderUri, true);
			} else {
				dirtyWorkspaces.set(dirtyWorkspace.workspace.configPath, dirtyWorkspace.workspace);
				hasWorkspaces = true;
			}
		}

		// Identify all recently opened folders and workspaces
		const recentFolders = new ResourceMap<boolean>();
		const recentWorkspaces = new ResourceMap<IWorkspaceIdentifier>();
		for (const recent of recentlyOpened.workspaces) {
			if (isRecentFolder(recent)) {
				recentFolders.set(recent.folderUri, true);
			} else {
				recentWorkspaces.set(recent.workspace.configPath, recent.workspace);
				hasWorkspaces = true;
			}
		}

		// Fill in all known recently opened workspaces
		const workspacePicks: IRecentlyOpenedPick[] = [];
		for (const recent of recentlyOpened.workspaces) {
			const isDirty = isRecentFolder(recent) ? dirtyFolders.has(recent.folderUri) : dirtyWorkspaces.has(recent.workspace.configPath);

			workspacePicks.push(this.toQuickPick(modelService, languageService, labelService, recent, isDirty));
		}

		// Fill any backup workspace that is not yet shown at the end
		for (const dirtyWorkspaceOrFolder of dirtyWorkspacesAndFolders) {
			if (isFolderBackupInfo(dirtyWorkspaceOrFolder) && !recentFolders.has(dirtyWorkspaceOrFolder.folderUri)) {
				workspacePicks.push(this.toQuickPick(modelService, languageService, labelService, dirtyWorkspaceOrFolder, true));
			} else if (isWorkspaceBackupInfo(dirtyWorkspaceOrFolder) && !recentWorkspaces.has(dirtyWorkspaceOrFolder.workspace.configPath)) {
				workspacePicks.push(this.toQuickPick(modelService, languageService, labelService, dirtyWorkspaceOrFolder, true));
			}
		}

		const filePicks = recentlyOpened.files.map(p => this.toQuickPick(modelService, languageService, labelService, p, false));

		// focus second entry if the first recent workspace is the current workspace
		const firstEntry = recentlyOpened.workspaces[0];
		const autoFocusSecondEntry: boolean = firstEntry && contextService.isCurrentWorkspace(isRecentWorkspace(firstEntry) ? firstEntry.workspace : firstEntry.folderUri);

		let keyMods: IKeyMods | undefined;

		const workspaceSeparator: IQuickPickSeparator = { type: 'separator', label: hasWorkspaces ? localize('workspacesAndFolders', "folders & workspaces") : localize('folders', "folders") };
		const fileSeparator: IQuickPickSeparator = { type: 'separator', label: localize('files', "files") };
		const picks = [workspaceSeparator, ...workspacePicks, fileSeparator, ...filePicks];

		const pick = await quickInputService.pick(picks, {
			contextKey: inRecentFilesPickerContextKey,
			activeItem: [...workspacePicks, ...filePicks][autoFocusSecondEntry ? 1 : 0],
			placeHolder: isMacintosh ? localize('openRecentPlaceholderMac', "Select to open (hold Cmd-key to force new window or Option-key for same window)") : localize('openRecentPlaceholder', "Select to open (hold Ctrl-key to force new window or Alt-key for same window)"),
			matchOnDescription: true,
			onKeyMods: mods => keyMods = mods,
			quickNavigate: this.isQuickNavigate() ? { keybindings: keybindingService.lookupKeybindings(this.desc.id) } : undefined,
			hideInput: this.isQuickNavigate(),
			onDidTriggerItemButton: async context => {

				// Remove
				if (context.button === this.removeFromRecentlyOpened) {
					await workspacesService.removeRecentlyOpened([context.item.resource]);
					context.removeItem();
				}

				// Dirty Folder/Workspace
				else if (context.button === this.dirtyRecentlyOpenedFolder || context.button === this.dirtyRecentlyOpenedWorkspace) {
					const isDirtyWorkspace = context.button === this.dirtyRecentlyOpenedWorkspace;
					const result = await dialogService.confirm({
						type: 'question',
						title: isDirtyWorkspace ? localize('dirtyWorkspace', "Workspace with Unsaved Files") : localize('dirtyFolder', "Folder with Unsaved Files"),
						message: isDirtyWorkspace ? localize('dirtyWorkspaceConfirm', "Do you want to open the workspace to review the unsaved files?") : localize('dirtyFolderConfirm', "Do you want to open the folder to review the unsaved files?"),
						detail: isDirtyWorkspace ? localize('dirtyWorkspaceConfirmDetail', "Workspaces with unsaved files cannot be removed until all unsaved files have been saved or reverted.") : localize('dirtyFolderConfirmDetail', "Folders with unsaved files cannot be removed until all unsaved files have been saved or reverted.")
					});

					if (result.confirmed) {
						hostService.openWindow(
							[context.item.openable], {
							remoteAuthority: context.item.remoteAuthority || null // local window if remoteAuthority is not set or can not be deducted from the openable
						});
						quickInputService.cancel();
					}
				}
			}
		});

		if (pick) {
			return hostService.openWindow([pick.openable], {
				forceNewWindow: keyMods?.ctrlCmd,
				forceReuseWindow: keyMods?.alt,
				remoteAuthority: pick.remoteAuthority || null // local window if remoteAuthority is not set or can not be deducted from the openable
			});
		}
	}

	private toQuickPick(modelService: IModelService, languageService: ILanguageService, labelService: ILabelService, recent: IRecent, isDirty: boolean): IRecentlyOpenedPick {
		let openable: IWindowOpenable | undefined;
		let iconClasses: string[];
		let fullLabel: string | undefined;
		let resource: URI | undefined;
		let isWorkspace = false;

		// Folder
		if (isRecentFolder(recent)) {
			resource = recent.folderUri;
			iconClasses = getIconClasses(modelService, languageService, resource, FileKind.FOLDER);
			openable = { folderUri: resource };
			fullLabel = recent.label || labelService.getWorkspaceLabel(resource, { verbose: Verbosity.LONG });
		}

		// Workspace
		else if (isRecentWorkspace(recent)) {
			resource = recent.workspace.configPath;
			iconClasses = getIconClasses(modelService, languageService, resource, FileKind.ROOT_FOLDER);
			openable = { workspaceUri: resource };
			fullLabel = recent.label || labelService.getWorkspaceLabel(recent.workspace, { verbose: Verbosity.LONG });
			isWorkspace = true;
		}

		// File
		else {
			resource = recent.fileUri;
			iconClasses = getIconClasses(modelService, languageService, resource, FileKind.FILE);
			openable = { pageUri: resource };
			fullLabel = recent.label || labelService.getUriLabel(resource);
		}

		const { name, parentPath } = splitName(fullLabel);

		return {
			iconClasses,
			label: name,
			ariaLabel: isDirty ? isWorkspace ? localize('recentDirtyWorkspaceAriaLabel', "{0}, workspace with unsaved changes", name) : localize('recentDirtyFolderAriaLabel', "{0}, folder with unsaved changes", name) : name,
			description: parentPath,
			buttons: isDirty ? [isWorkspace ? this.dirtyRecentlyOpenedWorkspace : this.dirtyRecentlyOpenedFolder] : [this.removeFromRecentlyOpened],
			openable,
			resource,
			remoteAuthority: recent.remoteAuthority
		};
	}
}

export class OpenRecentAction extends BaseOpenRecentAction {

	static ID = 'workbench.action.openRecent';

	constructor() {
		super({
			id: OpenRecentAction.ID,
			title: {
				value: localize('openRecent', "Open Recent..."),
				mnemonicTitle: localize({ key: 'miMore', comment: ['&& denotes a mnemonic'] }, "&&More..."),
				original: 'Open Recent...'
			},
			category: fileCategory,
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyCode.KeyR,
				mac: { primary: KeyMod.WinCtrl | KeyCode.KeyR }
			},
			menu: {
				id: MenuId.MenubarRecentMenu,
				group: 'y_more',
				order: 1
			}
		});
	}

	protected isQuickNavigate(): boolean {
		return false;
	}
}
