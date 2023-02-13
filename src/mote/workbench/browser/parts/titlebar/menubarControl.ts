import { localize } from 'mote/nls';
import { Action, ActionRunner, IAction, IActionRunner, Separator, SubmenuAction } from 'mote/base/common/actions';
import { RunOnceScheduler } from 'mote/base/common/async';
import { Disposable, DisposableStore } from 'mote/base/common/lifecycle';
import { URI } from 'mote/base/common/uri';
import { IMenu, IMenuService, MenuId, MenuItemAction, MenuRegistry, SubmenuItemAction } from 'mote/platform/actions/common/actions';
import { IContextKeyService } from 'mote/platform/contextkey/common/contextkey';
import { IRecent, IRecentlyOpened, isRecentWorkspace, IWorkspacesService } from 'mote/platform/workspaces/common/workspaces';
import { addDisposableListener, Dimension, EventType } from 'mote/base/browser/dom';
import { IMenuBarOptions, MenuBar } from 'mote/base/browser/ui/menu/menubar';
import { Emitter, Event } from 'mote/base/common/event';
import { defaultMenuStyles } from 'mote/platform/theme/browser/defaultStyles';
import { isMacintosh, isNative, isWeb } from 'mote/base/common/platform';
import { getMenuBarVisibility, IWindowOpenable, MenuBarVisibility } from 'mote/platform/window/common/window';
import { IConfigurationService } from 'mote/platform/configuration/common/configuration';
import { mnemonicMenuLabel, unmnemonicLabel } from 'mote/base/common/labels';
import { ICommandService } from 'mote/platform/commands/common/commands';
import { IKeybindingService } from 'mote/platform/keybinding/common/keybinding';
import { isFullscreen } from 'mote/base/browser/browser';
import { Direction } from 'mote/base/browser/ui/menu/menu';
import { isICommandActionToggleInfo } from 'mote/platform/action/common/action';
import { OpenRecentAction } from 'mote/workbench/browser/actions/windowActions';
import { IHostService } from 'mote/workbench/services/host/browser/host';
import { createAndFillInContextMenuActions } from 'mote/platform/actions/browser/menuEntryActionViewItem';

export type IOpenRecentAction = IAction & { uri: URI; remoteAuthority?: string };

MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
	submenu: MenuId.MenubarViewMenu,
	title: {
		value: 'View',
		original: 'View',
		mnemonicTitle: localize({ key: 'mView', comment: ['&& denotes a mnemonic'] }, "&&View")
	},
	order: 4
});

export abstract class MenubarControl extends Disposable {
	protected keys = [
		'window.menuBarVisibility',
		'window.enableMenuBarMnemonics',
		'window.customMenuBarAltFocus',
		'workbench.sideBar.location',
		'window.nativeTabs'
	];

	protected mainMenu: IMenu;
	protected menus: {
		[index: string]: IMenu | undefined;
	} = {};

	protected topLevelTitles: { [menu: string]: string } = {};

	protected mainMenuDisposables: DisposableStore;

	protected recentlyOpened: IRecentlyOpened = { pages: [], workspaces: [] };

	protected menuUpdater: RunOnceScheduler;

	protected static readonly MAX_MENU_RECENT_ENTRIES = 10;

	constructor(
		protected readonly menuService: IMenuService,
		protected readonly contextKeyService: IContextKeyService,
		protected readonly configurationService: IConfigurationService,
		protected readonly workspacesService: IWorkspacesService,
		protected readonly commandService: ICommandService,
		protected readonly keybindingService: IKeybindingService,
		protected readonly hostService: IHostService,
	) {
		super();

		this.mainMenu = this._register(this.menuService.createMenu(MenuId.MenubarMainMenu, this.contextKeyService));
		this.mainMenuDisposables = this._register(new DisposableStore());

		this.setupMainMenu();

		this.menuUpdater = this._register(new RunOnceScheduler(() => this.doUpdateMenubar(false), 200));

	}

	protected registerListeners(): void {
		// Listen for changes on the main menu
		this._register(this.mainMenu.onDidChange(() => { this.setupMainMenu(); this.doUpdateMenubar(true); }));
	}

	protected abstract doUpdateMenubar(firstTime: boolean): void;

	protected setupMainMenu(): void {
		this.mainMenuDisposables.clear();
		this.menus = {};
		this.topLevelTitles = {};

		const [, mainMenuActions] = this.mainMenu.getActions()[0];
		for (const mainMenuAction of mainMenuActions) {
			if (mainMenuAction instanceof SubmenuItemAction && typeof mainMenuAction.item.title !== 'string') {
				this.menus[mainMenuAction.item.title.original] = this.mainMenuDisposables.add(this.menuService.createMenu(mainMenuAction.item.submenu, this.contextKeyService, { emitEventsForSubmenuChanges: true }));
				this.topLevelTitles[mainMenuAction.item.title.original] = mainMenuAction.item.title.mnemonicTitle ?? mainMenuAction.item.title.value;
			}
		}
	}

	protected updateMenubar(): void {
		this.menuUpdater.schedule();
	}

	protected calculateActionLabel(action: { id: string; label: string }): string {
		const label = action.label;
		switch (action.id) {
			default:
				break;
		}

		return label;
	}

	protected onUpdateStateChange(): void {
		this.updateMenubar();
	}

	protected onUpdateKeybindings(): void {
		this.updateMenubar();
	}

	protected getOpenRecentActions(): (Separator | IOpenRecentAction)[] {
		if (!this.recentlyOpened) {
			return [];
		}

		const { workspaces, pages } = this.recentlyOpened;

		const result = [];

		if (workspaces.length > 0) {
			for (let i = 0; i < MenubarControl.MAX_MENU_RECENT_ENTRIES && i < workspaces.length; i++) {
				result.push(this.createOpenRecentMenuAction(workspaces[i]));
			}

			result.push(new Separator());
		}

		if (pages.length > 0) {
			for (let i = 0; i < MenubarControl.MAX_MENU_RECENT_ENTRIES && i < pages.length; i++) {
				result.push(this.createOpenRecentMenuAction(pages[i]));
			}

			result.push(new Separator());
		}

		return result;
	}

	private get menubarHidden(): boolean {
		return isMacintosh && isNative ? false : getMenuBarVisibility(this.configurationService) === 'hidden';
	}

	protected onDidChangeRecentlyOpened(): void {

		// Do not update recently opened when the menubar is hidden #108712
		if (!this.menubarHidden) {
			this.workspacesService.getRecentlyOpened().then(recentlyOpened => {
				this.recentlyOpened = recentlyOpened;
				this.updateMenubar();
			});
		}
	}

	private createOpenRecentMenuAction(recent: IRecent): IOpenRecentAction {

		let label: string;
		let uri: URI;
		let commandId: string;
		let openable: IWindowOpenable;
		const remoteAuthority = recent.remoteAuthority;

		if (isRecentWorkspace(recent)) {
			uri = recent.workspace.configPath;
			label = recent.label || '';// || this.labelService.getWorkspaceLabel(recent.workspace, { verbose: Verbosity.LONG });
			commandId = 'openRecentWorkspace';
			openable = { workspaceUri: uri };
		} else {
			uri = recent.pageUri;
			label = recent.label || '';// || this.labelService.getUriLabel(uri);
			commandId = 'openRecentFile';
			openable = { pageUri: uri };
		}

		const ret: IAction = new Action(commandId, unmnemonicLabel(label), undefined, undefined, event => {
			const browserEvent = event as KeyboardEvent;
			const openInNewWindow = event && ((!isMacintosh && (browserEvent.ctrlKey || browserEvent.shiftKey)) || (isMacintosh && (browserEvent.metaKey || browserEvent.altKey)));

			return this.hostService.openWindow([openable], {
				forceNewWindow: !!openInNewWindow,
				remoteAuthority: remoteAuthority || null // local window if remoteAuthority is not set or can not be deducted from the openable
			});
		});

		return Object.assign(ret, { uri, remoteAuthority });
	}
}

export class CustomMenubarControl extends MenubarControl {
	private menubar: MenuBar | undefined;
	private container: HTMLElement | undefined;
	private alwaysOnMnemonics: boolean = false;
	private focusInsideMenubar: boolean = false;
	private pendingFirstTimeUpdate: boolean = false;
	private visible: boolean = true;

	private actionRunner: IActionRunner;
	private readonly webNavigationMenu = this._register(this.menuService.createMenu(MenuId.MenubarHomeMenu, this.contextKeyService));

	private readonly _onVisibilityChange: Emitter<boolean> = this._register(new Emitter<boolean>());
	private readonly _onFocusStateChange: Emitter<boolean> = this._register(new Emitter<boolean>());

	constructor(
		@IMenuService menuService: IMenuService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IConfigurationService configurationService: IConfigurationService,
		@IWorkspacesService workspacesService: IWorkspacesService,
		@ICommandService commandService: ICommandService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IHostService hostService: IHostService,
	) {
		super(menuService, contextKeyService, configurationService, workspacesService, commandService, keybindingService, hostService);

		this.actionRunner = this._register(new ActionRunner());
	}

	protected doUpdateMenubar(firstTime: boolean): void {
		if (!this.focusInsideMenubar) {
			this.setupCustomMenubar(firstTime);
		}

		if (firstTime) {
			this.pendingFirstTimeUpdate = true;
		}
	}

	private getUpdateAction(): IAction | null {
		return null;
	}

	private get currentMenubarVisibility(): MenuBarVisibility {
		return getMenuBarVisibility(this.configurationService);
	}

	private get currentDisableMenuBarAltFocus(): boolean {
		const settingValue = this.configurationService.getValue<boolean>('window.customMenuBarAltFocus');

		let disableMenuBarAltBehavior = false;
		if (typeof settingValue === 'boolean') {
			disableMenuBarAltBehavior = !settingValue;
		}

		return disableMenuBarAltBehavior;
	}

	private get currentEnableMenuBarMnemonics(): boolean {
		let enableMenuBarMnemonics = this.configurationService.getValue<boolean>('window.enableMenuBarMnemonics');
		if (typeof enableMenuBarMnemonics !== 'boolean') {
			enableMenuBarMnemonics = true;
		}

		return enableMenuBarMnemonics && (!isWeb || isFullscreen());
	}

	private get currentCompactMenuMode(): Direction | undefined {
		if (this.currentMenubarVisibility !== 'compact') {
			return undefined;
		}

		// Menu bar lives in activity bar and should flow based on its location
		const currentSidebarLocation = this.configurationService.getValue<string>('workbench.sideBar.location');
		return currentSidebarLocation === 'right' ? Direction.Left : Direction.Right;
	}

	private insertActionsBefore(nextAction: IAction, target: IAction[]): void {
		switch (nextAction.id) {
			case OpenRecentAction.ID:
				target.push(...this.getOpenRecentActions());
				break;

			case 'workbench.action.showAboutDialog':
				if (!isMacintosh && !isWeb) {
					const updateAction = this.getUpdateAction();
					if (updateAction) {
						updateAction.label = mnemonicMenuLabel(updateAction.label);
						target.push(updateAction);
						target.push(new Separator());
					}
				}

				break;

			default:
				break;
		}
	}

	private onDidVisibilityChange(visible: boolean): void {
		this.visible = visible;
		this.onDidChangeRecentlyOpened();
		this._onVisibilityChange.fire(visible);
	}

	private toActionsArray(menu: IMenu): IAction[] {
		const result: IAction[] = [];
		createAndFillInContextMenuActions(menu, { shouldForwardArgs: true }, result);
		return result;
	}

	private reinstallDisposables = this._register(new DisposableStore());
	private setupCustomMenubar(firstTime: boolean): void {
		// If there is no container, we cannot setup the menubar
		if (!this.container) {
			return;
		}

		if (firstTime) {
			// Reset and create new menubar
			if (this.menubar) {
				this.reinstallDisposables.clear();
			}

			this.menubar = this.reinstallDisposables.add(new MenuBar(this.container, this.getMenuBarOptions(), defaultMenuStyles));

			/*
			this.accessibilityService.alwaysUnderlineAccessKeys().then(val => {
				this.alwaysOnMnemonics = val;
				this.menubar?.update(this.getMenuBarOptions());
			});
			*/

			this.reinstallDisposables.add(this.menubar.onFocusStateChange(focused => {
				this._onFocusStateChange.fire(focused);

				// When the menubar loses focus, update it to clear any pending updates
				if (!focused) {
					if (this.pendingFirstTimeUpdate) {
						this.setupCustomMenubar(true);
						this.pendingFirstTimeUpdate = false;
					} else {
						this.updateMenubar();
					}

					this.focusInsideMenubar = false;
				}
			}));

			this.reinstallDisposables.add(this.menubar.onVisibilityChange(e => this.onDidVisibilityChange(e)));

			// Before we focus the menubar, stop updates to it so that focus-related context keys will work
			this.reinstallDisposables.add(addDisposableListener(this.container, EventType.FOCUS_IN, () => {
				this.focusInsideMenubar = true;
			}));

			this.reinstallDisposables.add(addDisposableListener(this.container, EventType.FOCUS_OUT, () => {
				this.focusInsideMenubar = false;
			}));

			// Fire visibility change for the first install if menu is shown
			if (this.menubar.isVisible) {
				this.onDidVisibilityChange(true);
			}
		} else {
			this.menubar?.update(this.getMenuBarOptions());
		}

		// Update the menu actions
		const updateActions = (menuActions: readonly IAction[], target: IAction[], topLevelTitle: string) => {
			target.splice(0);

			for (const menuItem of menuActions) {
				this.insertActionsBefore(menuItem, target);

				if (menuItem instanceof Separator) {
					target.push(menuItem);
				} else if (menuItem instanceof SubmenuItemAction || menuItem instanceof MenuItemAction) {
					// use mnemonicTitle whenever possible
					let title = typeof menuItem.item.title === 'string'
						? menuItem.item.title
						: menuItem.item.title.mnemonicTitle ?? menuItem.item.title.value;

					if (menuItem instanceof SubmenuItemAction) {
						const submenuActions: SubmenuAction[] = [];
						updateActions(menuItem.actions, submenuActions, topLevelTitle);

						if (submenuActions.length > 0) {
							target.push(new SubmenuAction(menuItem.id, mnemonicMenuLabel(title), submenuActions));
						}
					} else {
						if (isICommandActionToggleInfo(menuItem.item.toggled)) {
							title = menuItem.item.toggled.mnemonicTitle ?? menuItem.item.toggled.title ?? title;
						}

						const newAction = new Action(menuItem.id, mnemonicMenuLabel(title), menuItem.class, menuItem.enabled, () => this.commandService.executeCommand(menuItem.id));
						newAction.tooltip = menuItem.tooltip;
						newAction.checked = menuItem.checked;
						target.push(newAction);
					}
				}

			}

			// Append web navigation menu items to the file menu when not compact
			if (topLevelTitle === 'File' && this.currentCompactMenuMode === undefined) {
				const webActions = this.getWebNavigationActions();
				if (webActions.length) {
					target.push(...webActions);
				}
			}
		};

		for (const title of Object.keys(this.topLevelTitles)) {
			const menu = this.menus[title];
			if (firstTime && menu) {
				this.reinstallDisposables.add(menu.onDidChange(() => {
					if (!this.focusInsideMenubar) {
						const actions: IAction[] = [];
						updateActions(this.toActionsArray(menu), actions, title);
						this.menubar?.updateMenu({ actions: actions, label: mnemonicMenuLabel(this.topLevelTitles[title]) });
					}
				}));

				// For the file menu, we need to update if the web nav menu updates as well
				if (menu === this.menus.File) {
					this.reinstallDisposables.add(this.webNavigationMenu.onDidChange(() => {
						if (!this.focusInsideMenubar) {
							const actions: IAction[] = [];
							updateActions(this.toActionsArray(menu), actions, title);
							this.menubar?.updateMenu({ actions: actions, label: mnemonicMenuLabel(this.topLevelTitles[title]) });
						}
					}));
				}
			}

			const actions: IAction[] = [];
			if (menu) {
				updateActions(this.toActionsArray(menu), actions, title);
			}

			if (this.menubar) {
				if (!firstTime) {
					this.menubar.updateMenu({ actions: actions, label: mnemonicMenuLabel(this.topLevelTitles[title]) });
				} else {
					this.menubar.push({ actions: actions, label: mnemonicMenuLabel(this.topLevelTitles[title]) });
				}
			}
		}
	}

	private getWebNavigationActions(): IAction[] {
		if (!isWeb) {
			return []; // only for web
		}

		const webNavigationActions = [];
		for (const groups of this.webNavigationMenu.getActions()) {
			const [, actions] = groups;
			for (const action of actions) {
				if (action instanceof MenuItemAction) {
					const title = typeof action.item.title === 'string'
						? action.item.title
						: action.item.title.mnemonicTitle ?? action.item.title.value;
					webNavigationActions.push(new Action(action.id, mnemonicMenuLabel(title), action.class, action.enabled, async (event?: any) => {
						this.commandService.executeCommand(action.id, event);
					}));
				}
			}

			webNavigationActions.push(new Separator());
		}

		if (webNavigationActions.length) {
			webNavigationActions.pop();
		}

		return webNavigationActions;
	}

	private getMenuBarOptions(): IMenuBarOptions {
		return {
			enableMnemonics: this.currentEnableMenuBarMnemonics,
			disableAltFocus: this.currentDisableMenuBarAltFocus,
			visibility: this.currentMenubarVisibility,
			actionRunner: this.actionRunner,
			getKeybinding: (action) => this.keybindingService.lookupKeybinding(action.id),
			alwaysOnMnemonics: this.alwaysOnMnemonics,
			compactMode: this.currentCompactMenuMode,
			getCompactMenuActions: () => {
				if (!isWeb) {
					return []; // only for web
				}

				return this.getWebNavigationActions();
			}
		};
	}

	protected override onDidChangeRecentlyOpened(): void {
		if (!this.visible) {
			return;
		}

		super.onDidChangeRecentlyOpened();
	}

	get onVisibilityChange(): Event<boolean> {
		return this._onVisibilityChange.event;
	}

	create(parent: HTMLElement): HTMLElement {
		this.container = parent;

		// Build the menubar
		if (this.container) {
			this.doUpdateMenubar(true);
		}

		return this.container;
	}

	layout(dimension: Dimension) {
		this.menubar?.update(this.getMenuBarOptions());
	}

	toggleFocus() {
		this.menubar?.toggleFocus();
	}
}
