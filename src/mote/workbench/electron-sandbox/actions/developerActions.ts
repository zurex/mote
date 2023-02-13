import { localize } from 'mote/nls';
import { KeyCode, KeyMod } from 'mote/base/common/keyCodes';
import { Categories } from 'mote/platform/action/common/actionCommonCategories';
import { Action2, MenuId } from 'mote/platform/actions/common/actions';
import { IsDevelopmentContext } from 'mote/platform/contextkey/common/contextkeys';
import { ServicesAccessor } from 'mote/platform/instantiation/common/instantiation';
import { KeybindingWeight } from 'mote/platform/keybinding/common/keybindingsRegistry';
import { INativeHostService } from 'mote/platform/native/electron-sandbox/native';

export class ToggleDevToolsAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.toggleDevTools',
			title: { value: localize('toggleDevTools', "Toggle Developer Tools"), original: 'Toggle Developer Tools' },
			category: Categories.Developer,
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib + 50,
				when: IsDevelopmentContext,
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyI,
				mac: { primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyI }
			},
			menu: {
				id: MenuId.MenubarHelpMenu,
				group: '5_tools',
				order: 1
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const nativeHostService = accessor.get(INativeHostService);

		return nativeHostService.toggleDevTools();
	}
}
