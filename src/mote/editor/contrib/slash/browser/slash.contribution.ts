import { EditorContextKeys } from 'mote/editor/common/editorContextKeys';
import { SlashCommand } from 'mote/editor/contrib/slash/browser/slash';
import { KeybindingsRegistry } from 'mote/platform/keybinding/common/keybindingsRegistry';
import { KeyCode } from 'vs/base/common/keyCodes';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';

export const slashTriggerId = 'editor.action.slash.trigger';

export const triggerSlashAction = new SlashCommand({
	id: slashTriggerId,
	precondition: undefined,
	handler(x) {
		x.showSlashCommandsMenu();
	}
});

KeybindingsRegistry.registerKeybindingRule({
	primary: KeyCode.Tab,
	weight: 200,
	id: triggerSlashAction.id,
	when: ContextKeyExpr.and(
		triggerSlashAction.precondition,
		EditorContextKeys.tabMovesFocus.toNegated(),
		//GhostTextController.inlineSuggestionHasIndentationLessThanTabSize
	),
});
