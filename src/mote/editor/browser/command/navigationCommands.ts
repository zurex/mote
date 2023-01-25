import { KeyCode, KeyMod } from 'mote/base/common/keyCodes';
import { CoreEditorCommand } from 'mote/editor/browser/command/coreCommands';
import { ICommandOptions, registerEditorCommand } from 'mote/editor/browser/editorExtensions';
import { IPosition, Position } from 'mote/editor/common/core/position';
import { ColumnSelection, IColumnSelectResult } from 'mote/editor/common/cursor/cursorColumnSelection';
import { CursorMove as CursorMove_, CursorMoveCommands } from 'mote/editor/common/cursor/cursorMoveCommands';
import { CursorState, IColumnSelectData, PartialCursorState } from 'mote/editor/common/cursorCommon';
import { CursorChangeReason } from 'mote/editor/common/cursorEvents';
import { EditorContextKeys } from 'mote/editor/common/editorContextKeys';
import { IViewModel } from 'mote/editor/common/viewModel';
import { ContextKeyExpr } from 'mote/platform/contextkey/common/contextkey';
import { KeybindingsRegistry, KeybindingWeight } from 'mote/platform/keybinding/common/keybindingsRegistry';

export const enum NavigationCommandRevealType {
	/**
	 * Do regular revealing.
	 */
	Regular = 0,
	/**
	 * Do only minimal revealing.
	 */
	Minimal = 1,
	/**
	 * Do not reveal the position.
	 */
	None = 2
}

export namespace CoreNavigationCommands {

	export interface BaseCommandOptions {
		source?: 'mouse' | 'keyboard' | string;
	}

	export interface MoveCommandOptions extends BaseCommandOptions {
		position: IPosition;
		viewPosition?: IPosition;
		revealType: NavigationCommandRevealType;
	}

	class BaseMoveToCommand extends CoreEditorCommand<MoveCommandOptions> {

		private readonly _inSelectionMode: boolean;

		constructor(opts: ICommandOptions & { inSelectionMode: boolean }) {
			super(opts);
			this._inSelectionMode = opts.inSelectionMode;
		}

		public runCoreEditorCommand(viewModel: IViewModel, args: Partial<MoveCommandOptions>): void {
			if (!args.position) {
				return;
			}

			const cursorStateChanged = viewModel.setCursorStates(
				args.source,
				CursorChangeReason.Explicit,
				[
					CursorMoveCommands.moveTo(viewModel, viewModel.getPrimaryCursorState(), this._inSelectionMode, args.position, args.viewPosition)
				]
			);
			if (cursorStateChanged && args.revealType !== NavigationCommandRevealType.None) {
				viewModel.revealPrimaryCursor(args.source, true, true);
			}
		}
	}

	export const MoveTo: CoreEditorCommand<MoveCommandOptions> = registerEditorCommand(new BaseMoveToCommand({
		id: '_moveTo',
		inSelectionMode: false,
		precondition: undefined
	}));

	export const MoveToSelect: CoreEditorCommand<MoveCommandOptions> = registerEditorCommand(new BaseMoveToCommand({
		id: '_moveToSelect',
		inSelectionMode: true,
		precondition: undefined
	}));

	abstract class ColumnSelectCommand<T extends BaseCommandOptions = BaseCommandOptions> extends CoreEditorCommand<T> {
		public runCoreEditorCommand(viewModel: IViewModel, args: Partial<T>): void {
			//viewModel.model.pushStackElement();
			const result = this._getColumnSelectResult(viewModel, viewModel.getPrimaryCursorState(), viewModel.getCursorColumnSelectData(), args);
			if (result === null) {
				// invalid arguments
				return;
			}
			viewModel.setCursorStates(args.source, CursorChangeReason.Explicit, result.viewStates.map((viewState) => CursorState.fromViewState(viewState)));
			viewModel.setCursorColumnSelectData({
				isReal: true,
				fromViewLineNumber: result.fromLineNumber,
				fromViewVisualColumn: result.fromVisualColumn,
				toViewLineNumber: result.toLineNumber,
				toViewVisualColumn: result.toVisualColumn
			});
			if (result.reversed) {
				viewModel.revealTopMostCursor(args.source);
			} else {
				viewModel.revealBottomMostCursor(args.source);
			}
		}

		protected abstract _getColumnSelectResult(viewModel: IViewModel, primary: CursorState, prevColumnSelectData: IColumnSelectData, args: Partial<T>): IColumnSelectResult | null;

	}

	export interface ColumnSelectCommandOptions extends BaseCommandOptions {
		position: IPosition;
		viewPosition: IPosition;
		mouseColumn: number;
		doColumnSelect: boolean;
	}

	export const ColumnSelect: CoreEditorCommand<ColumnSelectCommandOptions> = registerEditorCommand(new class extends ColumnSelectCommand<ColumnSelectCommandOptions> {
		constructor() {
			super({
				id: 'columnSelect',
				precondition: undefined
			});
		}

		protected _getColumnSelectResult(viewModel: IViewModel, primary: CursorState, prevColumnSelectData: IColumnSelectData, args: Partial<ColumnSelectCommandOptions>): IColumnSelectResult | null {
			if (typeof args.position === 'undefined' || typeof args.viewPosition === 'undefined' || typeof args.mouseColumn === 'undefined') {
				return null;
			}
			// validate `args`
			const validatedPosition = viewModel.model.validatePosition(args.position);
			const validatedViewPosition = viewModel.coordinatesConverter.validateViewPosition(new Position(args.viewPosition.lineNumber, args.viewPosition.column), validatedPosition);

			const fromViewLineNumber = args.doColumnSelect ? prevColumnSelectData.fromViewLineNumber : validatedViewPosition.lineNumber;
			const fromViewVisualColumn = args.doColumnSelect ? prevColumnSelectData.fromViewVisualColumn : args.mouseColumn - 1;
			return ColumnSelection.columnSelect(viewModel.cursorConfig, viewModel, fromViewLineNumber, fromViewVisualColumn, validatedViewPosition.lineNumber, args.mouseColumn - 1);
		}
	});

	export const CursorColumnSelectLeft: CoreEditorCommand<BaseCommandOptions> = registerEditorCommand(new class extends ColumnSelectCommand {
		constructor() {
			super({
				id: 'cursorColumnSelectLeft',
				precondition: undefined,
				kbOpts: {
					weight: KeybindingWeight.EditorCore,
					kbExpr: EditorContextKeys.textInputFocus,
					primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyCode.LeftArrow,
					linux: { primary: 0 }
				}
			});
		}

		protected _getColumnSelectResult(viewModel: IViewModel, primary: CursorState, prevColumnSelectData: IColumnSelectData, args: Partial<BaseCommandOptions>): IColumnSelectResult {
			return ColumnSelection.columnSelectLeft(viewModel.cursorConfig, viewModel, prevColumnSelectData);
		}
	});

	export class CursorMoveImpl extends CoreEditorCommand<CursorMove_.RawArguments> {
		constructor() {
			super({
				id: 'cursorMove',
				precondition: undefined,
				description: CursorMove_.description
			});
		}

		public runCoreEditorCommand(viewModel: IViewModel, args: Partial<BaseCommandOptions & CursorMove_.RawArguments>): void {
			const parsed = CursorMove_.parse(args);
			if (!parsed) {
				// illegal arguments
				return;
			}
			this._runCursorMove(viewModel, args.source, parsed);
		}

		private _runCursorMove(viewModel: IViewModel, source: string | null | undefined, args: CursorMove_.ParsedArguments): void {
			viewModel.model.pushStackElement();
			viewModel.setCursorStates(
				source,
				CursorChangeReason.Explicit,
				CursorMoveImpl._move(viewModel, viewModel.getCursorStates(), args)
			);
			viewModel.revealPrimaryCursor(source, true);
		}

		private static _move(viewModel: IViewModel, cursors: CursorState[], args: CursorMove_.ParsedArguments): PartialCursorState[] | null {
			const inSelectionMode = args.select;
			const value = args.value;

			switch (args.direction) {
				case CursorMove_.Direction.Left:
				case CursorMove_.Direction.Right:
				case CursorMove_.Direction.Up:
				case CursorMove_.Direction.Down:
				case CursorMove_.Direction.PrevBlankLine:
				case CursorMove_.Direction.NextBlankLine:
				case CursorMove_.Direction.WrappedLineStart:
				case CursorMove_.Direction.WrappedLineFirstNonWhitespaceCharacter:
				case CursorMove_.Direction.WrappedLineColumnCenter:
				case CursorMove_.Direction.WrappedLineEnd:
				case CursorMove_.Direction.WrappedLineLastNonWhitespaceCharacter:
					return CursorMoveCommands.simpleMove(viewModel, cursors, args.direction, inSelectionMode, value, args.unit);

				case CursorMove_.Direction.ViewPortTop:
				case CursorMove_.Direction.ViewPortBottom:
				case CursorMove_.Direction.ViewPortCenter:
				case CursorMove_.Direction.ViewPortIfOutside:
					return CursorMoveCommands.viewportMove(viewModel, cursors, args.direction, inSelectionMode, value);
				default:
					return null;
			}
		}
	}

	export const CursorMove: CursorMoveImpl = registerEditorCommand(new CursorMoveImpl());

	const enum Constants {
		PAGE_SIZE_MARKER = -1
	}

	export interface CursorMoveCommandOptions extends BaseCommandOptions {
		pageSize?: number;
	}

	class CursorMoveBasedCommand extends CoreEditorCommand<CursorMoveCommandOptions> {

		private readonly _staticArgs: CursorMove_.SimpleMoveArguments;

		constructor(opts: ICommandOptions & { args: CursorMove_.SimpleMoveArguments }) {
			super(opts);
			this._staticArgs = opts.args;
		}

		public runCoreEditorCommand(viewModel: IViewModel, dynamicArgs: Partial<CursorMoveCommandOptions>): void {
			let args = this._staticArgs;
			if (this._staticArgs.value === Constants.PAGE_SIZE_MARKER) {
				// -1 is a marker for page size
				args = {
					direction: this._staticArgs.direction,
					unit: this._staticArgs.unit,
					select: this._staticArgs.select,
					value: dynamicArgs.pageSize || viewModel.cursorConfig.pageSize
				};
			}

			viewModel.model.pushStackElement();
			viewModel.setCursorStates(
				dynamicArgs.source,
				CursorChangeReason.Explicit,
				CursorMoveCommands.simpleMove(viewModel, viewModel.getCursorStates(), args.direction, args.select, args.value, args.unit)
			);
			viewModel.revealPrimaryCursor(dynamicArgs.source, true);
		}
	}

	export const CursorLeft: CoreEditorCommand<CursorMoveCommandOptions> = registerEditorCommand(new CursorMoveBasedCommand({
		args: {
			direction: CursorMove_.Direction.Left,
			unit: CursorMove_.Unit.None,
			select: false,
			value: 1
		},
		id: 'cursorLeft',
		precondition: undefined,
		kbOpts: {
			weight: KeybindingWeight.EditorCore,
			kbExpr: EditorContextKeys.textInputFocus,
			primary: KeyCode.LeftArrow,
			mac: { primary: KeyCode.LeftArrow, secondary: [KeyMod.WinCtrl | KeyCode.KeyB] }
		}
	}));

	export const CursorRight: CoreEditorCommand<CursorMoveCommandOptions> = registerEditorCommand(new CursorMoveBasedCommand({
		args: {
			direction: CursorMove_.Direction.Right,
			unit: CursorMove_.Unit.None,
			select: false,
			value: 1
		},
		id: 'cursorRight',
		precondition: undefined,
		kbOpts: {
			weight: KeybindingWeight.EditorCore,
			kbExpr: EditorContextKeys.textInputFocus,
			primary: KeyCode.RightArrow,
			mac: { primary: KeyCode.RightArrow, secondary: [KeyMod.WinCtrl | KeyCode.KeyF] }
		}
	}));

	export const CursorUp: CoreEditorCommand<CursorMoveCommandOptions> = registerEditorCommand(new CursorMoveBasedCommand({
		args: {
			direction: CursorMove_.Direction.Up,
			unit: CursorMove_.Unit.WrappedLine,
			select: false,
			value: 1
		},
		id: 'cursorUp',
		precondition: undefined,
		kbOpts: {
			weight: KeybindingWeight.EditorCore,
			kbExpr: EditorContextKeys.textInputFocus,
			primary: KeyCode.UpArrow,
			mac: { primary: KeyCode.UpArrow, secondary: [KeyMod.WinCtrl | KeyCode.KeyP] }
		}
	}));

	export const CursorDown: CoreEditorCommand<CursorMoveCommandOptions> = registerEditorCommand(new CursorMoveBasedCommand({
		args: {
			direction: CursorMove_.Direction.Down,
			unit: CursorMove_.Unit.WrappedLine,
			select: false,
			value: 1
		},
		id: 'cursorDown',
		precondition: undefined,
		kbOpts: {
			weight: KeybindingWeight.EditorCore,
			kbExpr: EditorContextKeys.textInputFocus,
			primary: KeyCode.DownArrow,
			mac: { primary: KeyCode.DownArrow, secondary: [KeyMod.WinCtrl | KeyCode.KeyN] }
		}
	}));

}


const columnSelectionCondition = ContextKeyExpr.and(
	EditorContextKeys.textInputFocus,
	EditorContextKeys.columnSelection
);

function registerColumnSelection(id: string, keybinding: number): void {
	KeybindingsRegistry.registerKeybindingRule({
		id: id,
		primary: keybinding,
		when: columnSelectionCondition,
		weight: KeybindingWeight.EditorCore + 1
	});
}

registerColumnSelection(CoreNavigationCommands.CursorColumnSelectLeft.id, KeyMod.Shift | KeyCode.LeftArrow);
