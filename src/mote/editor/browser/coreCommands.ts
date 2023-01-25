import { IMoteEditor } from 'mote/editor/browser/editorBrowser';
import { EditorCommand, registerEditorCommand } from 'mote/editor/browser/editorExtensions';
import { EditorContextKeys } from 'mote/editor/common/editorContextKeys';
import { KeybindingWeight } from 'mote/platform/keybinding/common/keybindingsRegistry';
import { KeyCode, KeyMod } from 'mote/base/common/keyCodes';
import { ContextKeyExpr } from 'mote/platform/contextkey/common/contextkey';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';

const CORE_WEIGHT = KeybindingWeight.EditorCore;

export abstract class CoreEditorCommand extends EditorCommand {
	public runEditorCommand(accessor: ServicesAccessor | null, editor: IMoteEditor, args: any): void {
		const viewModel = editor.getStore();
		if (!viewModel) {
			// the editor has no view => has no cursors
			return;
		}
		this.runCoreEditorCommand(viewModel, args || {});
	}

	public abstract runCoreEditorCommand(viewModel: any, args: any): void;
}

export namespace CoreEditingCommands {
	export abstract class CoreEditingCommand extends EditorCommand {
		public runEditorCommand(accessor: ServicesAccessor, editor: IMoteEditor, args: any): void {
			const viewModel = editor.getStore();
			if (!viewModel) {
				// the editor has no view => has no cursors
				return;
			}
			this.runCoreEditingCommand(editor, viewModel, args || {});
		}

		public abstract runCoreEditingCommand(editor: IMoteEditor, viewModel: any, args: any): void;
	}

	export const LineBreakInsert: EditorCommand = registerEditorCommand(new class extends CoreEditingCommand {
		constructor() {
			super({
				id: 'lineBreakInsert',
				precondition: EditorContextKeys.writable,
				kbOpts: {
					weight: CORE_WEIGHT,
					kbExpr: EditorContextKeys.textInputFocus,
					primary: 0,
					mac: { primary: KeyMod.WinCtrl | KeyCode.KeyO }
				}
			});
		}

		public runCoreEditingCommand(editor: IMoteEditor, viewModel: any, args: any): void {
			//editor.pushUndoStop();
			//editor.executeCommands(this.id, TypeOperations.lineBreakInsert(viewModel.cursorConfig, viewModel.model, viewModel.getCursorStates().map(s => s.modelState.selection)));
		}
	});

	export const Tab: EditorCommand = registerEditorCommand(new class extends CoreEditingCommand {
		constructor() {
			super({
				id: 'tab',
				precondition: EditorContextKeys.writable,
				kbOpts: {
					weight: CORE_WEIGHT,
					kbExpr: ContextKeyExpr.and(
						EditorContextKeys.editorTextFocus,
						EditorContextKeys.tabDoesNotMoveFocus
					),
					primary: KeyCode.Tab
				}
			});
		}

		public runCoreEditingCommand(editor: IMoteEditor, viewModel: any, args: any): void {
			//editor.pushUndoStop();
			//editor.executeCommands(this.id, TypeOperations.tab(viewModel.cursorConfig, viewModel.model, viewModel.getCursorStates().map(s => s.modelState.selection)));
			//editor.pushUndoStop();
		}
	});

	export const Slash: EditorCommand = registerEditorCommand(new class extends CoreEditingCommand {
		constructor() {
			super({
				id: 'tab',
				precondition: EditorContextKeys.writable,
				kbOpts: {
					weight: CORE_WEIGHT,
					kbExpr: ContextKeyExpr.and(
						EditorContextKeys.editorTextFocus,
						EditorContextKeys.tabDoesNotMoveFocus
					),
					primary: KeyCode.Tab
				}
			});
		}

		public runCoreEditingCommand(editor: IMoteEditor, viewModel: any, args: any): void {
			//editor.pushUndoStop();
			//editor.executeCommands(this.id, TypeOperations.tab(viewModel.cursorConfig, viewModel.model, viewModel.getCursorStates().map(s => s.modelState.selection)));
			//editor.pushUndoStop();
		}
	});
}
