import { IMoteEditor } from 'mote/editor/browser/editorBrowser';
import { EditorCommand, registerEditorCommand } from 'mote/editor/browser/editorExtensions';
import { EditorContextKeys } from 'mote/editor/common/editorContextKeys';
import { KeybindingWeight } from 'mote/platform/keybinding/common/keybindingsRegistry';
import { KeyCode, KeyMod } from 'mote/base/common/keyCodes';
import { ContextKeyExpr } from 'mote/platform/contextkey/common/contextkey';
import { ServicesAccessor } from 'mote/platform/instantiation/common/instantiation';
import { IViewModel } from 'mote/editor/common/viewModel';
import { DeleteOperations } from 'mote/editor/common/cursor/cursorDeleteOperations';
import { EditOperationType } from 'mote/editor/common/cursorCommon';

const CORE_WEIGHT = KeybindingWeight.EditorCore;

export abstract class CoreEditorCommand<T> extends EditorCommand {
	public runEditorCommand(accessor: ServicesAccessor | null, editor: IMoteEditor, args: Partial<T>): void {
		const viewModel = editor._getViewModel();
		if (!viewModel) {
			// the editor has no view => has no cursors
			return;
		}
		this.runCoreEditorCommand(viewModel, args || {});
	}

	public abstract runCoreEditorCommand(viewModel: IViewModel, args: Partial<T>): void;
}

export namespace CoreEditingCommands {
	export abstract class CoreEditingCommand extends EditorCommand {
		public runEditorCommand(accessor: ServicesAccessor, editor: IMoteEditor, args: unknown): void {
			const viewModel = editor._getViewModel();
			if (!viewModel) {
				// the editor has no view => has no cursors
				return;
			}
			this.runCoreEditingCommand(editor, viewModel, args || {});
		}

		public abstract runCoreEditingCommand(editor: IMoteEditor, viewModel: IViewModel, args: unknown): void;
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

	export const DeleteLeft: EditorCommand = registerEditorCommand(new class extends CoreEditingCommand {
		constructor() {
			super({
				id: 'deleteLeft',
				precondition: undefined,
				kbOpts: {
					weight: CORE_WEIGHT,
					kbExpr: EditorContextKeys.textInputFocus,
					primary: KeyCode.Backspace,
					secondary: [KeyMod.Shift | KeyCode.Backspace],
					mac: { primary: KeyCode.Backspace, secondary: [KeyMod.Shift | KeyCode.Backspace, KeyMod.WinCtrl | KeyCode.KeyH, KeyMod.WinCtrl | KeyCode.Backspace] }
				}
			});
		}

		public runCoreEditingCommand(editor: IMoteEditor, viewModel: IViewModel, args: unknown): void {
			const [shouldPushStackElementBefore, commands] = DeleteOperations.deleteLeft(
				viewModel.getPrevEditOperationType(), viewModel.cursorConfig, viewModel.model,
				viewModel.getCursorStates().map(s => s.modelState.selection), viewModel.getCursorAutoClosedCharacters());
			if (shouldPushStackElementBefore) {
				editor.pushUndoStop();
			}
			editor.executeCommands(this.id, commands);
			viewModel.setPrevEditOperationType(EditOperationType.DeletingLeft);
		}
	});

	export const DeleteRight: EditorCommand = registerEditorCommand(new class extends CoreEditingCommand {
		constructor() {
			super({
				id: 'deleteRight',
				precondition: undefined,
				kbOpts: {
					weight: CORE_WEIGHT,
					kbExpr: EditorContextKeys.textInputFocus,
					primary: KeyCode.Delete,
					mac: { primary: KeyCode.Delete, secondary: [KeyMod.WinCtrl | KeyCode.KeyD, KeyMod.WinCtrl | KeyCode.Delete] }
				}
			});
		}

		public runCoreEditingCommand(editor: IMoteEditor, viewModel: IViewModel, args: unknown): void {
			const [shouldPushStackElementBefore, commands] = DeleteOperations.deleteRight(viewModel.getPrevEditOperationType(), viewModel.cursorConfig, viewModel.model, viewModel.getCursorStates().map(s => s.modelState.selection));
			if (shouldPushStackElementBefore) {
				editor.pushUndoStop();
			}
			editor.executeCommands(this.id, commands);
			viewModel.setPrevEditOperationType(EditOperationType.DeletingRight);
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
