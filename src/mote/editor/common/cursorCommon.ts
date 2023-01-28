import { CursorColumns } from 'mote/editor/common/core/cursorColumns';
import { EditorRange } from 'mote/editor/common/core/editorRange';
import { EditorSelection, ISelection } from 'mote/editor/common/core/editorSelection';
import { Position } from 'mote/editor/common/core/position';
import { ICommand } from 'mote/editor/common/editorCommon';
import { PositionAffinity } from 'mote/editor/common/model';


export interface IColumnSelectData {
	isReal: boolean;
	fromViewLineNumber: number;
	fromViewVisualColumn: number;
	toViewLineNumber: number;
	toViewVisualColumn: number;
}

/**
 * This is an operation type that will be recorded for undo/redo purposes.
 * The goal is to introduce an undo stop when the controller switches between different operation types.
 */
export const enum EditOperationType {
	Other = 0,
	DeletingLeft = 2,
	DeletingRight = 3,
	TypingOther = 4,
	TypingFirstSpace = 5,
	TypingConsecutiveSpace = 6,
}

export interface CharacterMap {
	[char: string]: string;
}

//const autoCloseAlways = () => true;
//const autoCloseNever = () => false;
//const autoCloseBeforeWhitespace = (chr: string) => (chr === ' ' || chr === '\t');

export class CursorConfiguration {
	public readonly useTabStops: boolean = false;
	public readonly tabSize: number = 4;
	public readonly indentSize: number = 4;
	public readonly pageSize: number = 100;
	public readonly multiCursorLimit: number = 3;
	public readonly multiCursorMergeOverlapping: boolean = false;
	public readonly wordSeparators: string = '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?';

	/**
	 * Returns a visible column from a column.
	 * @see {@link CursorColumns}
	 */
	public columnFromVisibleColumn(model: ICursorSimpleModel, lineNumber: number, visibleColumn: number): number {
		const result = CursorColumns.columnFromVisibleColumn(model.getLineContent(lineNumber), visibleColumn, this.tabSize);

		const minColumn = model.getLineMinColumn(lineNumber);
		if (result < minColumn) {
			return minColumn;
		}

		const maxColumn = model.getLineMaxColumn(lineNumber);
		if (result > maxColumn) {
			return maxColumn;
		}

		return result;
	}

	/**
	 * Returns a visible column from a column.
	 * @see {@link CursorColumns}
	 */
	public visibleColumnFromColumn(model: ICursorSimpleModel, position: Position): number {
		return CursorColumns.visibleColumnFromColumn(model.getLineContent(position.lineNumber), position.column, this.tabSize);
	}
}

export interface ICursorSimpleModel {
	getLineCount(): number;
	getLineContent(lineNumber: number): string;
	getLineMinColumn(lineNumber: number): number;
	getLineMaxColumn(lineNumber: number): number;

	normalizePosition(position: Position, affinity: PositionAffinity): Position;
}

export type PartialCursorState = CursorState | PartialModelCursorState | PartialViewCursorState;

export class CursorState {
	_cursorStateBrand: void = undefined;

	public static fromModelState(modelState: SingleCursorState): PartialModelCursorState {
		return new PartialModelCursorState(modelState);
	}

	public static fromViewState(viewState: SingleCursorState): PartialViewCursorState {
		return new PartialViewCursorState(viewState);
	}

	public static fromModelSelection(modelSelection: ISelection): PartialModelCursorState {
		const selection = EditorSelection.liftSelection(modelSelection);
		const modelState = new SingleCursorState(
			EditorRange.fromPositions(selection.getSelectionStart()),
			SelectionStartKind.Simple, 0,
			selection.getPosition(), 0
		);
		return CursorState.fromModelState(modelState);
	}

	public static fromModelSelections(modelSelections: readonly ISelection[]): PartialModelCursorState[] {
		const states: PartialModelCursorState[] = [];
		for (let i = 0, len = modelSelections.length; i < len; i++) {
			states[i] = this.fromModelSelection(modelSelections[i]);
		}
		return states;
	}

	readonly modelState: SingleCursorState;
	readonly viewState: SingleCursorState;

	constructor(modelState: SingleCursorState, viewState: SingleCursorState) {
		this.modelState = modelState;
		this.viewState = viewState;
	}

	public equals(other: CursorState): boolean {
		return (this.viewState.equals(other.viewState) && this.modelState.equals(other.modelState));
	}
}

export class PartialModelCursorState {
	readonly modelState: SingleCursorState;
	readonly viewState: null;

	constructor(modelState: SingleCursorState) {
		this.modelState = modelState;
		this.viewState = null;
	}
}

export class PartialViewCursorState {
	readonly modelState: null;
	readonly viewState: SingleCursorState;

	constructor(viewState: SingleCursorState) {
		this.modelState = null;
		this.viewState = viewState;
	}
}

export const enum SelectionStartKind {
	Simple,
	Word,
	Line
}

/**
 * Represents the cursor state on either the model or on the view model.
 */
export class SingleCursorState {
	_singleCursorStateBrand: void = undefined;

	public readonly selection: EditorSelection;

	constructor(
		public readonly selectionStart: EditorRange,
		public readonly selectionStartKind: SelectionStartKind,
		public readonly selectionStartLeftoverVisibleColumns: number,
		public readonly position: Position,
		public readonly leftoverVisibleColumns: number,
	) {
		this.selection = SingleCursorState._computeSelection(this.selectionStart, this.position);
	}

	public equals(other: SingleCursorState) {
		return (
			this.selectionStartLeftoverVisibleColumns === other.selectionStartLeftoverVisibleColumns
			&& this.leftoverVisibleColumns === other.leftoverVisibleColumns
			&& this.selectionStartKind === other.selectionStartKind
			&& this.position.equals(other.position)
			&& this.selectionStart.equalsRange(other.selectionStart)
		);
	}

	public hasSelection(): boolean {
		return (!this.selection.isEmpty() || !this.selectionStart.isEmpty());
	}

	public move(inSelectionMode: boolean, lineNumber: number, column: number, leftoverVisibleColumns: number): SingleCursorState {
		if (inSelectionMode) {
			// move just position
			return new SingleCursorState(
				this.selectionStart,
				this.selectionStartKind,
				this.selectionStartLeftoverVisibleColumns,
				new Position(lineNumber, column),
				leftoverVisibleColumns
			);
		} else {
			// move everything
			return new SingleCursorState(
				new EditorRange(lineNumber, column, lineNumber, column),
				SelectionStartKind.Simple,
				leftoverVisibleColumns,
				new Position(lineNumber, column),
				leftoverVisibleColumns
			);
		}
	}

	private static _computeSelection(selectionStart: EditorRange, position: Position): EditorSelection {
		if (selectionStart.isEmpty() || !position.isBeforeOrEqual(selectionStart.getStartPosition())) {
			return EditorSelection.fromPositions(selectionStart.getStartPosition(), position);
		} else {
			return EditorSelection.fromPositions(selectionStart.getEndPosition(), position);
		}
	}
}

export class EditOperationResult {
	_editOperationResultBrand: void = undefined;

	readonly type: EditOperationType;
	readonly commands: Array<ICommand | null>;
	readonly shouldPushStackElementBefore: boolean;
	readonly shouldPushStackElementAfter: boolean;

	constructor(
		type: EditOperationType,
		commands: Array<ICommand | null>,
		opts: {
			shouldPushStackElementBefore: boolean;
			shouldPushStackElementAfter: boolean;
		}
	) {
		this.type = type;
		this.commands = commands;
		this.shouldPushStackElementBefore = opts.shouldPushStackElementBefore;
		this.shouldPushStackElementAfter = opts.shouldPushStackElementAfter;
	}
}

export function isQuote(ch: string): boolean {
	return (ch === '\'' || ch === '"' || ch === '`');
}
