import { ModifierKeyEmitter } from 'mote/base/browser/dom';
import { KeyCode, KeyMod } from 'mote/base/common/keyCodes';
import { isMacintosh } from 'mote/base/common/platform';
import { registerAction2 } from 'mote/platform/actions/common/actions';
import { IConfigurationService } from 'mote/platform/configuration/common/configuration';
import { ServicesAccessor } from 'mote/platform/instantiation/common/instantiation';
import { KeybindingsRegistry, KeybindingWeight } from 'mote/platform/keybinding/common/keybindingsRegistry';
import { INativeHostService } from 'mote/platform/native/electron-sandbox/native';
import { ToggleDevToolsAction } from 'mote/workbench/electron-sandbox/actions/developerActions';
import { NativeWindow } from 'mote/workbench/electron-sandbox/window';
import { ShutdownReason } from 'mote/workbench/services/lifecycle/common/lifecycle';

// Actions
(function registerActions(): void {

	if (isMacintosh) {
		// macOS: behave like other native apps that have documents
		// but can run without a document opened and allow to close
		// the window when the last document is closed
		// (https://github.com/microsoft/vscode/issues/126042)
		/*
		KeybindingsRegistry.registerKeybindingRule({
			id: CloseWindowAction.ID,
			weight: KeybindingWeight.WorkbenchContrib,
			when: ContextKeyExpr.and(EditorsVisibleContext.toNegated(), SingleEditorGroupsContext),
			primary: KeyMod.CtrlCmd | KeyCode.KeyW
		});
		*/
	}

	// Quit
	KeybindingsRegistry.registerCommandAndKeybindingRule({
		id: 'workbench.action.quit',
		weight: KeybindingWeight.WorkbenchContrib,
		async handler(accessor: ServicesAccessor) {
			const nativeHostService = accessor.get(INativeHostService);
			const configurationService = accessor.get(IConfigurationService);

			const confirmBeforeClose = configurationService.getValue<'always' | 'never' | 'keyboardOnly'>('window.confirmBeforeClose');
			if (confirmBeforeClose === 'always' || (confirmBeforeClose === 'keyboardOnly' && ModifierKeyEmitter.getInstance().isModifierPressed)) {
				const confirmed = await NativeWindow.confirmOnShutdown(accessor, ShutdownReason.QUIT);
				if (!confirmed) {
					return; // quit prevented by user
				}
			}

			nativeHostService.quit();
		},
		when: undefined,
		mac: { primary: KeyMod.CtrlCmd | KeyCode.KeyQ },
		linux: { primary: KeyMod.CtrlCmd | KeyCode.KeyQ }
	});

	// Actions: Developer
	registerAction2(ToggleDevToolsAction);

})();
