import { Codicon } from 'mote/base/common/codicons';
import { KeyCode, KeyMod } from 'mote/base/common/keyCodes';
import { DisposableStore } from 'mote/base/common/lifecycle';
import { isMacintosh, isNative } from 'mote/base/common/platform';
import { ThemeIcon } from 'mote/base/common/themables';
import { localize } from 'mote/nls';
import { Categories } from 'mote/platform/action/common/actionCommonCategories';
import { Action2, MenuId, MenuRegistry, registerAction2 } from 'mote/platform/actions/common/actions';
import { ICommandService } from 'mote/platform/commands/common/commands';
import { IConfigurationService } from 'mote/platform/configuration/common/configuration';
import { ContextKeyExpr, ContextKeyExpression, IContextKeyService } from 'mote/platform/contextkey/common/contextkey';
import { IsMacNativeContext } from 'mote/platform/contextkey/common/contextkeys';
import { ServicesAccessor } from 'mote/platform/instantiation/common/instantiation';
import { KeybindingWeight } from 'mote/platform/keybinding/common/keybindingsRegistry';
import { IQuickInputService, IQuickPick, IQuickPickItem, QuickPickItem } from 'mote/platform/quickinput/common/quickInput';
import { registerIcon } from 'mote/platform/theme/common/iconRegistry';
import { SideBarVisibleContext } from 'mote/workbench/browser/workbenchContextKeys';
import { IWorkbenchLayoutService, Parts, Position } from 'mote/workbench/services/layout/browser/layoutService';

// Register Icons
const menubarIcon = registerIcon('menuBar', Codicon.layoutMenubar, localize('menuBarIcon', "Represents the menu bar"));
const panelLeftIcon = registerIcon('panel-left', Codicon.layoutSidebarLeft, localize('panelLeft', "Represents a side bar in the left position"));
const panelLeftOffIcon = registerIcon('panel-left-off', Codicon.layoutSidebarLeftOff, localize('panelLeftOff', "Represents a side bar in the left position toggled off"));
const panelRightIcon = registerIcon('panel-right', Codicon.layoutSidebarRight, localize('panelRight', "Represents side bar in the right position"));
const panelRightOffIcon = registerIcon('panel-right-off', Codicon.layoutSidebarRightOff, localize('panelRightOff', "Represents side bar in the right position toggled off"));

const statusBarIcon = registerIcon('statusBar', Codicon.layoutStatusbar, localize('statusBarIcon', "Represents the status bar"));

const fullscreenIcon = registerIcon('fullscreen', Codicon.screenFull, localize('fullScreenIcon', "Represents full screen"));
const centerLayoutIcon = registerIcon('centerLayoutIcon', Codicon.layoutCentered, localize('centerLayoutIcon', "Represents centered layout mode"));
const zenModeIcon = registerIcon('zenMode', Codicon.target, localize('zenModeIcon', "Represents zen mode"));

/**
 * Close sidebar
 */
registerAction2(class extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.closeSidebar',
			title: { value: localize('closeSidebar', "Close Primary Side Bar"), original: 'Close Primary Side Bar' },
			category: Categories.View,
			f1: true
		});
	}

	run(accessor: ServicesAccessor): void {
		accessor.get(IWorkbenchLayoutService).setPartHidden(true, Parts.SIDEBAR_PART);
	}
});

//#region Sidebar Position

const sidebarPositionConfigurationKey = 'workbench.sideBar.location';

export class ToggleSidebarPositionAction extends Action2 {

	static readonly ID = 'workbench.action.toggleSidebarPosition';
	static readonly LABEL = localize('toggleSidebarPosition', "Toggle Primary Side Bar Position");

	static getLabel(layoutService: IWorkbenchLayoutService): string {
		return layoutService.getSideBarPosition() === Position.LEFT ? localize('moveSidebarRight', "Move Primary Side Bar Right") : localize('moveSidebarLeft', "Move Primary Side Bar Left");
	}

	constructor() {
		super({
			id: ToggleSidebarPositionAction.ID,
			title: { value: localize('toggleSidebarPosition', "Toggle Primary Side Bar Position"), original: 'Toggle Primary Side Bar Position' },
			category: Categories.View,
			f1: true
		});
	}

	run(accessor: ServicesAccessor): Promise<void> {
		const layoutService = accessor.get(IWorkbenchLayoutService);
		const configurationService = accessor.get(IConfigurationService);

		const position = layoutService.getSideBarPosition();
		const newPositionValue = (position === Position.LEFT) ? 'right' : 'left';

		return configurationService.updateValue(sidebarPositionConfigurationKey, newPositionValue);
	}
}

registerAction2(ToggleSidebarPositionAction);

//#endregion

const configureLayoutIcon = registerIcon('configure-layout-icon', Codicon.layout, localize('cofigureLayoutIcon', 'Icon represents workbench layout configuration.'));

MenuRegistry.appendMenuItem(MenuId.LayoutControlMenu, {
	submenu: MenuId.LayoutControlMenuSubmenu,
	title: localize('configureLayout', "Configure Layout"),
	icon: configureLayoutIcon,
	group: '1_workbench_layout',
	when: ContextKeyExpr.equals('config.workbench.layoutControl.type', 'menu')
});

class ToggleSidebarVisibilityAction extends Action2 {

	static readonly ID = 'workbench.action.toggleSidebarVisibility';

	constructor() {
		super({
			id: ToggleSidebarVisibilityAction.ID,
			title: { value: localize('toggleSidebar', "Toggle Primary Side Bar Visibility"), original: 'Toggle Primary Side Bar Visibility' },
			toggled: {
				condition: SideBarVisibleContext,
				title: localize('primary sidebar', "Primary Side Bar"),
				mnemonicTitle: localize({ key: 'primary sidebar mnemonic', comment: ['&& denotes a mnemonic'] }, "&&Primary Side Bar"),
			},
			category: Categories.View,
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyCode.KeyB
			},
			menu: [
				{
					id: MenuId.LayoutControlMenuSubmenu,
					group: '0_workbench_layout',
					order: 0
				},
				{
					id: MenuId.MenubarAppearanceMenu,
					group: '2_workbench_layout',
					order: 1
				}
			]
		});
	}

	run(accessor: ServicesAccessor): void {
		const layoutService = accessor.get(IWorkbenchLayoutService);

		layoutService.setPartHidden(layoutService.isVisible(Parts.SIDEBAR_PART), Parts.SIDEBAR_PART);
	}
}

registerAction2(ToggleSidebarVisibilityAction);

MenuRegistry.appendMenuItems([
	{
		id: MenuId.LayoutControlMenu,
		item: {
			group: '0_workbench_toggles',
			command: {
				id: ToggleSidebarVisibilityAction.ID,
				title: localize('toggleSideBar', "Toggle Primary Side Bar"),
				icon: panelLeftOffIcon,
				toggled: { condition: SideBarVisibleContext, icon: panelLeftIcon }
			},
			when: ContextKeyExpr.and(ContextKeyExpr.or(ContextKeyExpr.equals('config.workbench.layoutControl.type', 'toggles'), ContextKeyExpr.equals('config.workbench.layoutControl.type', 'both')), ContextKeyExpr.equals('config.workbench.sideBar.location', 'left')),
			order: 0
		}
	}, {
		id: MenuId.LayoutControlMenu,
		item: {
			group: '0_workbench_toggles',
			command: {
				id: ToggleSidebarVisibilityAction.ID,
				title: localize('toggleSideBar', "Toggle Primary Side Bar"),
				icon: panelRightOffIcon,
				toggled: { condition: SideBarVisibleContext, icon: panelRightIcon }
			},
			when: ContextKeyExpr.and(ContextKeyExpr.or(ContextKeyExpr.equals('config.workbench.layoutControl.type', 'toggles'), ContextKeyExpr.equals('config.workbench.layoutControl.type', 'both')), ContextKeyExpr.equals('config.workbench.sideBar.location', 'right')),
			order: 2
		}
	}
]);

type ContextualLayoutVisualIcon = { iconA: ThemeIcon; iconB: ThemeIcon; whenA: ContextKeyExpression };
type LayoutVisualIcon = ThemeIcon | ContextualLayoutVisualIcon;

function isContextualLayoutVisualIcon(icon: LayoutVisualIcon): icon is ContextualLayoutVisualIcon {
	return (icon as ContextualLayoutVisualIcon).iconA !== undefined;
}

interface CustomizeLayoutItem {
	id: string;
	active: ContextKeyExpression;
	label: string;
	activeIcon: ThemeIcon;
	visualIcon?: LayoutVisualIcon;
	activeAriaLabel: string;
	inactiveIcon?: ThemeIcon;
	inactiveAriaLabel?: string;
	useButtons: boolean;
}

const CreateToggleLayoutItem = (id: string, active: ContextKeyExpression, label: string, visualIcon?: LayoutVisualIcon): CustomizeLayoutItem => {
	return {
		id,
		active,
		label,
		visualIcon,
		activeIcon: Codicon.eye,
		inactiveIcon: Codicon.eyeClosed,
		activeAriaLabel: localize('selectToHide', "Select to Hide"),
		inactiveAriaLabel: localize('selectToShow', "Select to Show"),
		useButtons: true,
	};
};

const MenuBarToggledContext = ContextKeyExpr.and(IsMacNativeContext.toNegated(), ContextKeyExpr.notEquals('config.window.menuBarVisibility', 'hidden'), ContextKeyExpr.notEquals('config.window.menuBarVisibility', 'toggle'), ContextKeyExpr.notEquals('config.window.menuBarVisibility', 'compact')) as ContextKeyExpression;
const ToggleVisibilityActions: CustomizeLayoutItem[] = [];
if (!isMacintosh || !isNative) {
	ToggleVisibilityActions.push(CreateToggleLayoutItem('workbench.action.toggleMenuBar', MenuBarToggledContext, localize('menuBar', "Menu Bar"), menubarIcon));
}

ToggleVisibilityActions.push(...[
	CreateToggleLayoutItem(ToggleSidebarVisibilityAction.ID, SideBarVisibleContext, localize('sideBar', "Primary Side Bar"), { whenA: ContextKeyExpr.equals('config.workbench.sideBar.location', 'left'), iconA: panelLeftIcon, iconB: panelRightIcon }),
]);

const LayoutContextKeySet = new Set<string>();
for (const { active } of [...ToggleVisibilityActions,]) {
	for (const key of active.keys()) {
		LayoutContextKeySet.add(key);
	}
}

registerAction2(class CustomizeLayoutAction extends Action2 {

	private _currentQuickPick?: IQuickPick<IQuickPickItem>;

	constructor() {
		super({
			id: 'workbench.action.customizeLayout',
			title: { original: 'Customize Layout...', value: localize('customizeLayout', "Customize Layout...") },
			f1: true,
			icon: configureLayoutIcon,
			menu: [
				{
					id: MenuId.LayoutControlMenuSubmenu,
					group: 'z_end',
				},
				{
					id: MenuId.LayoutControlMenu,
					when: ContextKeyExpr.equals('config.workbench.layoutControl.type', 'both'),
					group: 'z_end'
				}
			]
		});
	}

	getItems(contextKeyService: IContextKeyService): QuickPickItem[] {
		const toQuickPickItem = (item: CustomizeLayoutItem): IQuickPickItem => {
			const toggled = item.active.evaluate(contextKeyService.getContext(null));
			let label = item.useButtons ?
				item.label :
				item.label + (toggled && item.activeIcon ? ` $(${item.activeIcon.id})` : (!toggled && item.inactiveIcon ? ` $(${item.inactiveIcon.id})` : ''));
			const ariaLabel =
				item.label + (toggled && item.activeAriaLabel ? ` (${item.activeAriaLabel})` : (!toggled && item.inactiveAriaLabel ? ` (${item.inactiveAriaLabel})` : ''));

			if (item.visualIcon) {
				let icon = item.visualIcon;
				if (isContextualLayoutVisualIcon(icon)) {
					const useIconA = icon.whenA.evaluate(contextKeyService.getContext(null));
					icon = useIconA ? icon.iconA : icon.iconB;
				}

				label = `$(${icon.id}) ${label}`;
			}

			const icon = toggled ? item.activeIcon : item.inactiveIcon;

			return {
				type: 'item',
				id: item.id,
				label,
				ariaLabel,
				buttons: !item.useButtons ? undefined : [
					{
						alwaysVisible: false,
						tooltip: ariaLabel,
						iconClass: icon ? ThemeIcon.asClassName(icon) : undefined
					}
				]
			};
		};
		return [
			{
				type: 'separator',
				label: localize('toggleVisibility', "Visibility")
			},
			...ToggleVisibilityActions.map(toQuickPickItem),
			{
				type: 'separator',
				label: localize('sideBarPosition', "Primary Side Bar Position")
			},
			/*
			...MoveSideBarActions.map(toQuickPickItem),
			{
				type: 'separator',
				label: localize('panelAlignment', "Panel Alignment")
			},
			...AlignPanelActions.map(toQuickPickItem),
			{
				type: 'separator',
				label: localize('layoutModes', "Modes"),
			},
			...MiscLayoutOptions.map(toQuickPickItem),
			*/
		];
	}

	run(accessor: ServicesAccessor): void {
		if (this._currentQuickPick) {
			this._currentQuickPick.hide();
			return;
		}

		const configurationService = accessor.get(IConfigurationService);
		const contextKeyService = accessor.get(IContextKeyService);
		const commandService = accessor.get(ICommandService);
		const quickInputService = accessor.get(IQuickInputService);
		const quickPick = quickInputService.createQuickPick();

		this._currentQuickPick = quickPick;
		quickPick.items = this.getItems(contextKeyService);
		quickPick.ignoreFocusOut = true;
		quickPick.hideInput = true;
		quickPick.title = localize('customizeLayoutQuickPickTitle', "Customize Layout");

		const closeButton = {
			alwaysVisible: true,
			iconClass: ThemeIcon.asClassName(Codicon.close),
			tooltip: localize('close', "Close")
		};

		const resetButton = {
			alwaysVisible: true,
			iconClass: ThemeIcon.asClassName(Codicon.discard),
			tooltip: localize('restore defaults', "Restore Defaults")
		};

		quickPick.buttons = [
			resetButton,
			closeButton
		];

		const disposables = new DisposableStore();
		let selectedItem: CustomizeLayoutItem | undefined = undefined;
		disposables.add(contextKeyService.onDidChangeContext(changeEvent => {
			if (changeEvent.affectsSome(LayoutContextKeySet)) {
				quickPick.items = this.getItems(contextKeyService);
				if (selectedItem) {
					quickPick.activeItems = quickPick.items.filter(item => (item as CustomizeLayoutItem).id === selectedItem?.id) as IQuickPickItem[];
				}

				setTimeout(() => quickInputService.focus(), 0);
			}
		}));

		quickPick.onDidAccept(event => {
			if (quickPick.selectedItems.length) {
				selectedItem = quickPick.selectedItems[0] as CustomizeLayoutItem;
				commandService.executeCommand(selectedItem.id);
			}
		});

		quickPick.onDidTriggerItemButton(event => {
			if (event.item) {
				selectedItem = event.item as CustomizeLayoutItem;
				commandService.executeCommand(selectedItem.id);
			}
		});

		quickPick.onDidTriggerButton((button) => {
			if (button === closeButton) {
				quickPick.hide();
			} else if (button === resetButton) {

				const resetSetting = (id: string) => {
					const config = configurationService.inspect(id);
					configurationService.updateValue(id, config.defaultValue);
				};

				// Reset all layout options
				resetSetting('workbench.activityBar.visible');
				resetSetting('workbench.sideBar.location');
				resetSetting('workbench.statusBar.visible');
				resetSetting('workbench.panel.defaultLocation');

				if (!isMacintosh || !isNative) {
					resetSetting('window.menuBarVisibility');
				}

				commandService.executeCommand('workbench.action.alignPanelCenter');
			}
		});

		quickPick.onDidHide(() => {
			quickPick.dispose();
		});

		quickPick.onDispose(() => {
			this._currentQuickPick = undefined;
			disposables.dispose();
		});

		quickPick.show();
	}
});
